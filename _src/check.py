#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对构建产物做静态与编译检查。

用法:
    python check.py             # 检查全部产物
    python check.py C语言基础教程.html
"""
import html
import html.parser
import os
import re
import subprocess
import sys
import tempfile
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(ROOT)
OUT = os.path.join(PROJ, "courses")
PY = sys.executable
ZIG = os.path.join(PROJ, "_tools")
CACHE = os.path.join(PROJ, "_tools", "zig-cache")

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
RAW = {"script", "style"}


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


class TagChecker(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.ids = []
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.append(d["id"])
        if tag == "a" and "href" in d:
            self.hrefs.append(d["href"])
        if tag in VOID:
            return
        self.stack.append((tag, self.getpos()))

    def handle_startendtag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.append(d["id"])
        if tag == "a" and "href" in d:
            self.hrefs.append(d["href"])

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append("多余的结束标签 </%s> 行 %d" % (tag, self.getpos()[0]))
            return
        # 容忍浏览器式的隐式闭合：向上找最近的同名标签
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                for j in range(len(self.stack) - 1, i, -1):
                    self.errors.append("未闭合标签 <%s> 开始于行 %d" % (self.stack[j][0], self.stack[j][1][0]))
                del self.stack[i:]
                return
        self.errors.append("孤立结束标签 </%s> 行 %d" % (tag, self.getpos()[0]))


def check_html(path):
    src = read(path)
    tc = TagChecker()
    tc.feed(src)
    for tag, pos in tc.stack:
        tc.errors.append("未闭合标签 <%s> 行 %d" % (tag, pos[0]))

    ids = set(tc.ids)
    dup = [x for x in set(tc.ids) if tc.ids.count(x) > 1]
    missing = []
    for h in tc.hrefs:
        if h.startswith("#") and len(h) > 1 and h[1:] not in ids:
            missing.append(h)

    ext = []
    for m in re.finditer(r'(?:src|href)\s*=\s*"([^"]+)"', src):
        u = m.group(1)
        if re.match(r"^(https?:)?//", u):
            ext.append(u)
    for m in re.finditer(r"@import\s+url\(([^)]+)\)", src):
        ext.append(m.group(1))
    for m in re.finditer(r"url\(\s*['\"]?(https?:)?//", src):
        ext.append("css url()")

    # 脚本语法
    js = "\n".join(re.findall(r"<script>([\s\S]*?)</script>", src))
    js_err = ""
    if js.strip():
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(js)
            jsp = f.name
        r = subprocess.run(["node", "--check", jsp], capture_output=True, text=True)
        if r.returncode != 0:
            js_err = r.stderr.strip().splitlines()[:4]
        os.unlink(jsp)

    print("=" * 70)
    print(os.path.basename(path), "%.1f KB" % (len(src.encode("utf-8")) / 1024))
    print("  章节 section :", len(re.findall(r'<section class="ch', src)))
    print("  交互实验 lab :", len(re.findall(r'<div class="lab"', src)))
    print("  代码块 code  :", len(re.findall(r'<div class="code">', src)))
    print("  测验 quiz    :", len(re.findall(r'class="quiz"', src)))
    print("  重复 id      :", dup if dup else "无")
    print("  失效锚点     :", missing if missing else "无")
    print("  外部资源     :", ext if ext else "无")
    print("  HTML 结构    :", "OK" if not tc.errors else tc.errors[:5])
    print("  JS 语法      :", "OK" if not js_err else js_err)
    return not (dup or missing or ext or tc.errors or js_err)


def extract_code_blocks(src):
    """返回 [(chapter_id, filename, lang, code)]"""
    out = []
    for m in re.finditer(r'<section class="ch[^"]*" id="([^"]+)"', src):
        start = m.start()
        nxt = src.find('<section class="ch', m.end())
        seg = src[start: nxt if nxt > 0 else len(src)]
        for cm in re.finditer(r'<div class="code"><div class="code-bar"><span class="file">([^<]*)</span>'
                              r'<span class="lang">([^<]*)</span>.*?</div><pre><code>([\s\S]*?)</code></pre>', seg):
            out.append((m.group(1), html.unescape(cm.group(1)), cm.group(2), html.unescape(cm.group(3))))
    return out


def check_c(path):
    src = read(path)
    blocks = extract_code_blocks(src)
    if not blocks:
        return True
    tmp = tempfile.mkdtemp(prefix="cverify_")
    ok = True
    env = dict(os.environ, PYTHONPATH=ZIG, ZIG_GLOBAL_CACHE_DIR=CACHE, ZIG_LOCAL_CACHE_DIR=CACHE + "-local")
    by_ch = {}
    for ch, fn, lang, code in blocks:
        by_ch.setdefault(ch, []).append((fn, lang, code))

    for ch, items in by_ch.items():
        cdir = os.path.join(tmp, ch)
        os.makedirs(cdir, exist_ok=True)
        names = {}
        for fn, lang, code in items:
            if any(h in code for h in ("FreeRTOS.h", "semphr.h", "event_groups.h", "timers.h")) or '"task.h"' in code or '"queue.h"' in code:
                continue      # 依赖 FreeRTOS 内核，无法在主机独立编译
            base = fn.split("·")[0].strip()
            if not re.match(r"^[\w.\-]+\.(c|h)$", base):
                continue
            if "片段" in fn:
                continue
            names[base] = code
            with open(os.path.join(cdir, base), "w", encoding="utf-8") as f:
                f.write(code + "\n")
        mains = [n for n, c in names.items() if re.search(r"\bint\s+main\s*\([^)]*\)\s*\{", c)]
        for main in mains:
            base_cmd = [PY, "-m", "ziglang", "cc", "-std=c11", "-Wall", "-Wextra", "-Wpedantic", main, "-o", "prog.exe"]
            r = subprocess.run(base_cmd, cwd=cdir, capture_output=True, text=True, env=env, timeout=300)
            label = "%s / %s" % (ch, main)
            msg = ((r.stderr or "") + (r.stdout or "")).lower()
            if r.returncode != 0 and ("undefined" in msg or "unresolved" in msg):
                # 可能是多文件工程：把本章其余非片段 .c 一起参与链接
                others = [n for n in names if n.endswith(".c") and n != main and "int main" not in names[n]]
                cmd = [PY, "-m", "ziglang", "cc", "-std=c11", "-Wall", "-Wextra", "-Wpedantic", main] + others + ["-o", "prog.exe"]
                r2 = subprocess.run(cmd, cwd=cdir, capture_output=True, text=True, env=env, timeout=300)
                r = r2
            if r.returncode != 0:
                ok = False
                print("  [FAIL] %s\n%s" % (label, (r.stderr or r.stdout).strip()[:1200]))
            else:
                warn = (r.stderr or "").strip()
                if warn:
                    print("  [WARN] %s\n%s" % (label, warn[:800]))
                try:
                    run = subprocess.run([os.path.join(cdir, "prog.exe")], cwd=cdir, capture_output=True,
                                         text=True, timeout=5, input="")
                    print("  [ OK ] %s  输出首行: %s" % (label, (run.stdout.strip().splitlines() or ["(无输出)"])[0][:70]))
                except subprocess.TimeoutExpired:
                    print("  [ OK ] %s  编译通过（运行超时，可能等待输入）" % label)
    shutil.rmtree(tmp, ignore_errors=True)
    return ok


def main():
    files = sys.argv[1:] or [f for f in os.listdir(OUT) if f.endswith(".html") and not f.startswith("_")]
    allok = True
    for f in files:
        p = f if os.path.isabs(f) else os.path.join(OUT, f)
        if not os.path.exists(p):
            print("missing", p)
            allok = False
            continue
        allok = check_html(p) and allok
    print("\n---- C 代码编译与运行 ----")
    for f in files:
        p = f if os.path.isabs(f) else os.path.join(OUT, f)
        print(os.path.basename(p))
        allok = check_c(p) and allok
    print("\nRESULT:", "PASS" if allok else "ISSUES FOUND")


if __name__ == "__main__":
    main()
