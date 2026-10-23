#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 _src/courses/<slug>/ 下的章节片段组装成可离线使用的单文件 HTML。

用法:
    python build.py            # 构建全部
    python build.py c-basics   # 只构建某一册
"""
import json
import os
import re
import sys
import html

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), "courses")
ASSETS = os.path.join(ROOT, "assets")

CODE_RE = re.compile(r"<codeblock([^>]*)>([\s\S]*?)</codeblock>")
OUT_RE = re.compile(r"<outblock(?:\s+label=\"([^\"]*)\")?>([\s\S]*?)</outblock>")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def attr_map(s):
    return dict(re.findall(r'([\w-]+)="([^"]*)"', s))


def esc_code(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_code(m):
    a = attr_map(m.group(1))
    code = m.group(2)
    code = code.strip("\n")
    # 去掉片段里为排版统一加的 4 空格缩进
    lines = code.split("\n")
    if lines and all((not l.strip()) or l.startswith("    ") for l in lines):
        code = "\n".join(l[4:] if l.startswith("    ") else l for l in lines)
    file_ = a.get("file", "代码")
    lang = a.get("lang", "C")
    return (
        '<div class="code"><div class="code-bar"><span class="file">%s</span>'
        '<span class="lang">%s</span><button class="copy" type="button" aria-label="复制这段代码">复制</button>'
        "</div><pre><code>%s</code></pre></div>" % (html.escape(file_), html.escape(lang), esc_code(code))
    )


def render_out(m):
    label = m.group(1) or "运行结果"
    return '<div class="out"><b>%s</b><pre>%s</pre></div>' % (html.escape(label), esc_code(m.group(2).strip("\n")))


def process_body(body, ch_id):
    body = CODE_RE.sub(render_code, body)
    body = OUT_RE.sub(render_out, body)
    # h3 自动编号锚点
    n = [0]

    def h3(m):
        tag = m.group(0)
        if "id=" in tag:
            return tag
        n[0] += 1
        return tag.replace("<h3", '<h3 id="%s-s%d"' % (ch_id, n[0]), 1)

    body = re.sub(r"<h3(?=[\s>])[^>]*>", h3, body)
    # 图号
    fig = [0]

    def cap(m):
        fig[0] += 1
        inner = m.group(1)
        if inner.strip().startswith("图"):
            return m.group(0)
        return "<figcaption>图 %s-%d\u3000%s</figcaption>" % (ch_id.replace("ch", "").lstrip("0"), fig[0], inner)

    body = re.sub(r"<figcaption>([\s\S]*?)</figcaption>", cap, body)
    return body


def build_course(meta):
    slug = meta["slug"]
    cdir = os.path.join(ROOT, "courses", slug)
    css = read(os.path.join(ASSETS, "base.css"))
    core = read(os.path.join(ASSETS, "core.js"))
    labs_path = os.path.join(ASSETS, "labs-%s.js" % slug)
    labs = read(labs_path) if os.path.exists(labs_path) else ""

    p = meta["palette"]
    theme_css = """
:root{--accent:%(accent)s;--accent-d:%(accentD)s;--accent-soft:%(soft)s;--accent-line:%(line)s;--accent-ink:%(ink)s}
html[data-theme="dark"]{--accent:%(dAccent)s;--accent-d:%(dAccentD)s;--accent-soft:%(dSoft)s;--accent-line:%(dLine)s;--accent-ink:%(dInk)s}
""" % p

    chapters = meta["chapters"]
    app = meta.get("appendix")

    # ---- 侧栏目录 ----
    toc = ['<li><a href="#map"><b>00</b><span>课程地图与学习路径</span></a></li>']
    for ch in chapters:
        toc.append('<li><a href="#%s"><b>%s</b><span>%s</span></a></li>' % (ch["id"], ch["num"], html.escape(ch["short"])))
    if app:
        toc.append('<li><a href="#%s"><b>附</b><span>%s</span></a></li>' % (app["id"], html.escape(app["short"])))
    toc_html = "\n".join(toc)

    # ---- 课程地图 ----
    items = []
    for ch in chapters:
        items.append(
            '<a class="mapitem" href="#%s"><span class="n">第 %s 讲</span><b>%s</b><span>%s</span>'
            '<span class="t">%s</span></a>'
            % (ch["id"], ch["num"], html.escape(ch["title"]), html.escape(ch["short"]), html.escape(ch["time"]))
        )
    if app:
        items.append(
            '<a class="mapitem" href="#%s"><span class="n">附录</span><b>%s</b><span>%s</span><span class="t">%s</span></a>'
            % (app["id"], html.escape(app["title"]), html.escape(app["short"]), html.escape(app["time"]))
        )
    map_html = "\n".join(items)

    # ---- 章节 ----
    body_parts = []
    total = len(chapters)
    for i, ch in enumerate(chapters):
        raw = read(os.path.join(cdir, ch["body"]))
        inner = process_body(raw, ch["id"])
        goals = "".join("<li>%s</li>" % g for g in ch["goals"])
        prev_next = []
        if i > 0:
            prev_next.append('<a href="#%s">← 第 %s 讲</a>' % (chapters[i - 1]["id"], chapters[i - 1]["num"]))
        else:
            prev_next.append('<a href="#map">← 课程地图</a>')
        if i < total - 1:
            prev_next.append('<a href="#%s">第 %s 讲 →</a>' % (chapters[i + 1]["id"], chapters[i + 1]["num"]))
        elif app:
            prev_next.append('<a href="#%s">附录 →</a>' % app["id"])
        body_parts.append(
            """<section class="ch" id="%(id)s" aria-labelledby="%(id)s-h">
<header class="ch-head">
  <div class="ch-no" aria-hidden="true">%(num)s</div>
  <div class="ch-title">
    <p class="ch-kicker">%(kicker)s</p>
    <h2 id="%(id)s-h">%(title)s</h2>
    <p class="ch-lede">%(lede)s</p>
  </div>
</header>
<div class="goals"><h3>学完这一讲，你能</h3><ul>%(goals)s</ul></div>
%(body)s
<footer class="ch-foot"><span>第 %(num)s 讲 · 共 %(total)d 讲</span><span class="ch-nav">%(nav)s</span></footer>
</section>"""
            % {
                "id": ch["id"], "num": ch["num"], "kicker": ch["kicker"], "title": ch["title"],
                "lede": ch["lede"], "goals": goals, "body": inner, "total": total,
                "nav": " ".join(prev_next),
            }
        )
    if app:
        raw = read(os.path.join(cdir, app["body"]))
        inner = process_body(raw, app["id"])
        body_parts.append(
            """<section class="ch appendix" id="%(id)s" aria-labelledby="%(id)s-h">
<header class="ch-head">
  <div class="ch-no" aria-hidden="true">附</div>
  <div class="ch-title">
    <p class="ch-kicker">%(kicker)s</p>
    <h2 id="%(id)s-h">%(title)s</h2>
    <p class="ch-lede">%(lede)s</p>
  </div>
</header>
%(body)s
<footer class="ch-foot"><span>%(foot)s</span><a href="#map">回到课程地图 ↑</a></footer>
</section>"""
            % {"id": app["id"], "kicker": app["kicker"], "title": app["title"], "lede": app["lede"],
               "body": inner, "foot": app.get("foot", "附录")}
        )

    # ---- 封面档案 ----
    rows = "".join('<div class="row"><dt>%s</dt><dd>%s</dd></div>' % (k, v) for k, v in meta["dossier"])
    tags = "".join('<span class="ctag"><i></i>%s</span>' % t for t in meta["tags"])
    path = []
    for b in meta["series"]:
        cls = " on" if b["slug"] == slug else ""
        path.append('<span class="%s">%d · %s</span>' % (cls.strip() or "off", b["book"], html.escape(b["short"])))
    path_html = "".join(path)

    page = """<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="%(desc)s">
<title>%(title)s · 嵌入式学习路径</title>
<style>
%(css)s
%(theme)s
</style>
</head>
<body>
<a class="skip" href="#map">跳到正文</a>

<header class="topbar">
  <div class="topbar-in">
    <button class="icon-btn" id="menuBtn" type="button" aria-label="打开课程目录" aria-expanded="false" aria-controls="sidebar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <a class="brand" href="#top">
      <span class="brand-mark" aria-hidden="true">E%(book)d</span>
      <span class="brand-txt"><b>%(short)s</b><span>嵌入式学习路径 · 第 %(book)d 册</span></span>
    </a>
    <span class="topbar-sp"></span>
    <button class="icon-btn" id="searchBtn" type="button" aria-label="搜索本册内容（Ctrl+K）">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <span class="lbl">搜索</span>
    </button>
    <button class="icon-btn" id="themeBtn" type="button" aria-pressed="false" aria-label="切换到深色模式">
      <svg class="ic-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>
      <svg class="ic-moon" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>
    </button>
  </div>
  <div class="progress" id="progressBar" aria-hidden="true"></div>
</header>

<div id="top"></div>
<section class="cover">
  <div class="cover-in">
    <div class="cover-grid">
      <div>
        <p class="series-tag">%(kicker)s</p>
        <h1>%(coverTitle)s</h1>
        <p class="sub">%(sub)s</p>
        <div class="cover-tags">%(tags)s</div>
        <div class="cover-actions">
          <a class="btn btn-primary" href="#map">开始学习</a>
          <a class="btn btn-ghost" href="#%(firstId)s">直接进入第 01 讲</a>
          <button class="btn btn-ghost" type="button" onclick="window.print()">打印 / 导出 PDF</button>
        </div>
        <div class="pathstrip" aria-label="系列中的位置">%(path)s</div>
      </div>
      <aside class="dossier" aria-label="课程档案">
        <h2>课程档案</h2>
        <dl>%(rows)s</dl>
        <p class="note">%(note)s</p>
      </aside>
    </div>
  </div>
</section>

<div class="scrim" id="scrim"></div>
<div class="shell">
  <nav class="sidebar" id="sidebar" aria-label="课程目录">
    <h2>课程目录</h2>
    <ol class="toc">
%(toc)s
    </ol>
    <div class="side-tools">
      <button class="icon-btn" type="button" onclick="window.print()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>
        <span>打印 / 导出 PDF</span>
      </button>
      <a class="icon-btn" href="#top">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        <span>回到顶部</span>
      </a>
    </div>
  </nav>

  <main class="main" id="main">
    <section class="mapcard" id="map">
      <h2>课程地图</h2>
      <p>%(mapIntro)s</p>
      <div class="mapgrid">
%(map)s
      </div>
    </section>
%(chapters)s
  </main>

  <aside class="rail" id="rail" aria-label="本讲目录">
    <p class="rail-kicker">本讲目录</p>
    <p class="rail-title" id="railTitle">课程地图</p>
    <ol class="rail-list" id="railList"></ol>
    <div class="rail-progress">
      <b id="railPct">0%%</b>
      <span>本册阅读进度</span>
    </div>
  </aside>
</div>

<footer class="foot">
  <div class="foot-in">
    <div><b>%(title)s</b> · 嵌入式学习路径 第 %(book)d 册 / 共 5 册<br>单文件离线教程，可直接双击打开，无需联网。</div>
    <div class="foot-links"><a href="#map">课程地图</a><a href="#top">回到顶部</a><span>© <span id="year">2026</span></span></div>
  </div>
</footer>

<button class="totop" id="toTop" type="button" aria-label="回到顶部">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
</button>

<div class="searchbox" id="searchBox" role="dialog" aria-modal="true" aria-label="搜索本册内容">
  <div class="search-panel">
    <div class="search-top">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
      <input id="searchInput" type="search" placeholder="搜索概念、API、错误信息……" autocomplete="off" aria-label="搜索关键词">
      <kbd>Esc</kbd>
    </div>
    <div class="search-res" id="searchRes"></div>
  </div>
</div>

<script>
%(core)s
%(labs)s
</script>
</body>
</html>
""" % {
        "desc": html.escape(meta["desc"]),
        "title": html.escape(meta["title"]),
        "short": html.escape(meta["short"]),
        "book": meta["book"],
        "kicker": meta["kicker"],
        "coverTitle": meta["coverTitle"],
        "sub": meta["sub"],
        "tags": tags,
        "rows": rows,
        "note": meta["note"],
        "path": path_html,
        "toc": toc_html,
        "map": map_html,
        "mapIntro": meta["mapIntro"],
        "chapters": "\n".join(body_parts),
        "firstId": chapters[0]["id"],
        "css": css,
        "theme": theme_css,
        "core": core,
        "labs": labs,
    }
    outfile = os.path.join(OUT, meta["file"])
    with open(outfile, "w", encoding="utf-8", newline="\n") as f:
        f.write(page)
    return outfile, len(page)


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    metas = []
    croot = os.path.join(ROOT, "courses")
    for slug in sorted(os.listdir(croot)):
        mp = os.path.join(croot, slug, "meta.json")
        if os.path.exists(mp):
            metas.append(json.loads(read(mp)))
    metas.sort(key=lambda m: m["book"])
    for m in metas:
        if only and m["slug"] != only:
            continue
        path, size = build_course(m)
        print("built %-40s %7.1f KB" % (os.path.basename(path), size / 1024))


if __name__ == "__main__":
    main()
