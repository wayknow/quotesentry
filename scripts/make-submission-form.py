#!/usr/bin/env python3
"""Generate the filled submission form as a printable DOCX."""

from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "submission" / "QuoteSentry-作品提报信息表.docx"

INK = RGBColor(16, 37, 31)
MUTED = RGBColor(91, 108, 102)
TEAL = RGBColor(10, 107, 83)

FONT = "PingFang SC"
MONO = "Menlo"


def set_run(run, size=10.5, bold=False, color=INK, font=FONT):
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = OxmlElement("w:rFonts")
        rPr.insert(0, rFonts)
    rFonts.set(qn("w:eastAsia"), FONT)
    rFonts.set(qn("w:ascii"), font)
    rFonts.set(qn("w:hAnsi"), font)


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def cell_margins(cell, top=100, start=140, bottom=100, end=140):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)
    for tag, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tcMar.find(qn(f"w:{tag}"))
        if node is None:
            node = OxmlElement(f"w:{tag}")
            tcMar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def table_borders(table, color="DCE6E0", size=4):
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), str(size))
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)
        borders.append(element)
    table._tbl.tblPr.append(borders)


def set_width(cell, width):
    cell.width = width
    tcPr = cell._tc.get_or_add_tcPr()
    tcW = tcPr.find(qn("w:tcW"))
    if tcW is None:
        tcW = OxmlElement("w:tcW")
        tcPr.append(tcW)
    tcW.set(qn("w:w"), str(int(width.twips)))
    tcW.set(qn("w:type"), "dxa")


def set_table_width(table, widths):
    tbl = table._tbl
    tblPr = tbl.tblPr
    tblW = tblPr.find(qn("w:tblW"))
    if tblW is None:
        tblW = OxmlElement("w:tblW")
        tblPr.append(tblW)
    tblW.set(qn("w:type"), "dxa")
    tblW.set(qn("w:w"), str(sum(int(width.twips) for width in widths)))

    layout = tblPr.find(qn("w:tblLayout"))
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        tblPr.append(layout)
    layout.set(qn("w:type"), "fixed")

    grid = tbl.find(qn("w:tblGrid"))
    if grid is not None:
        for gridCol, width in zip(grid.findall(qn("w:gridCol")), widths):
            gridCol.set(qn("w:w"), str(int(width.twips)))


def prevent_split(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(OxmlElement("w:cantSplit"))


def add_section(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    set_run(p.add_run(text), 12.5, True, TEAL)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), "51D4A8")
    pBdr.append(bottom)
    pPr.append(pBdr)


def add_label(doc, text, note=""):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    set_run(p.add_run(text), 10, True, INK)
    if note:
        set_run(p.add_run(f"  {note}"), 8.5, False, MUTED)


def add_callout(doc, text, size=10.5, color=INK, bold=False):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    cell = table.cell(0, 0)
    set_width(cell, Cm(17.0))
    shade(cell, "F4F9F6")
    cell_margins(cell, 140, 180, 140, 180)

    tcPr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "18")
    left.set(qn("w:space"), "0")
    left.set(qn("w:color"), "0A6B53")
    borders.append(left)
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.35
    set_run(p.add_run(text), size, bold, color)


def add_check(doc, checked, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.2)
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run(("☑" if checked else "☐") + "  "), 11, True, TEAL if checked else MUTED)
    set_run(p.add_run(text), 10, False, INK)


def build():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.7)
    section.bottom_margin = Cm(1.5)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)

    style = doc.styles["Normal"]
    style.font.name = FONT
    style.font.size = Pt(10.5)
    style.font.color.rgb = INK
    style.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    style.paragraph_format.space_after = Pt(4)
    style.paragraph_format.line_spacing = 1.3

    doc.core_properties.title = "《作品提报信息表》— QuoteSentry 报价哨兵"
    doc.core_properties.author = "wayknow"
    doc.core_properties.subject = "Agent 赛道参赛作品"

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run("AGENT 赛道  /  参赛作品"), 8.5, True, TEAL)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    set_run(p.add_run("《作品提报信息表》"), 21, True, INK)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(8)
    set_run(p.add_run("QuoteSentry 报价哨兵  ·  紧固件外贸询价审单 Agent"), 10, False, MUTED)

    add_section(doc, "一、项目信息")

    rows = [
        ("作品名称", [("QuoteSentry 报价哨兵", {"bold": True, "size": 10.5})]),
        ("参赛形式", [("个人参赛", {})]),
        ("团队名称", [("不适用", {})]),
        ("负责人姓名", [("wayknow", {"bold": True})]),
        ("负责人联系电话", [(" ", {})]),
        ("负责人邮箱", [("develop@wayknow.tech", {"font": MONO, "size": 9.5})]),
        ("选手身份类型", [("成年人", {})]),
        ("所属院校 / 单位", [("wayknow", {})]),
        ("团队其他成员", [("无", {})]),
        (
            "Agent 体验访问链接 / 二维码",
            [
                (
                    "https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08",
                    {"color": TEAL, "font": MONO, "size": 9.2},
                ),
                (
                    "二维码文件：submission/assets/QuoteSentry-demo-qr-card.png",
                    {"color": MUTED, "size": 8.5},
                ),
            ],
        ),
        ("演示视频文件名称", [("QuoteSentry-demo-zh.mp4", {"font": MONO, "size": 9.5})]),
    ]

    table = doc.add_table(rows=0, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table_borders(table)
    set_table_width(table, [Cm(4.7), Cm(12.3)])

    for label, lines in rows:
        row = table.add_row()
        prevent_split(row)
        label_cell, value_cell = row.cells
        set_width(label_cell, Cm(4.7))
        set_width(value_cell, Cm(12.3))
        shade(label_cell, "F2F7F4")
        for cell in row.cells:
            cell_margins(cell)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        p = label_cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        set_run(p.add_run(label), 9.8, True, INK)

        p = value_cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.2
        for index, (text, options) in enumerate(lines):
            if index:
                p = value_cell.add_paragraph()
                p.paragraph_format.space_before = Pt(1)
                p.paragraph_format.space_after = Pt(0)
            set_run(
                p.add_run(text),
                options.get("size", 10),
                options.get("bold", False),
                options.get("color", INK),
                options.get("font", FONT),
            )

    add_section(doc, "二、项目补充信息")
    add_label(doc, "作品一句话定位", "≤30 字")
    add_callout(doc, "QuoteSentry 报价哨兵｜紧固件外贸询价审单 Agent", 11.5, TEAL, True)

    add_label(doc, "作品简要介绍", "150 字以内")
    add_callout(
        doc,
        "QuoteSentry 报价哨兵面向高混紧固件外贸商，把邮件和 Excel 询价逐行转成可审批报价。"
        "大模型负责抽取和解释，私有目录与确定性规则负责匹配计价；缺参、目录外和毛利越界会阻断，"
        "最终由人审批并留下审计记录。当前使用仿真数据演示，不宣称真实客户收益。",
        10,
    )

    add_label(doc, "文件包内材料清单")
    add_check(doc, True, "1–3 分钟 Demo 演示视频")
    add_check(doc, True, "Agent 体验链接 / 二维码")
    add_check(doc, True, "产品解决方案")
    add_check(doc, False, "负责人身份证正反面照片")
    add_check(doc, False, "未成年人：选手身份材料 + 监护人身份证照片（如适用）")

    add_section(doc, "三、签字")
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(14)
    set_run(p.add_run("填报人签字：________________________________"), 11, False, INK)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    set_run(p.add_run("填报日期：2026 年 11 月 26 日"), 11, False, INK)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
