#!/usr/bin/env python3
from pathlib import Path
from typing import Optional

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "submission" / "assets"
OUTPUT = ROOT / "submission" / "QuoteSentry-产品解决方案-8模块.docx"

INK = RGBColor(16, 37, 31)
MUTED = RGBColor(91, 108, 102)
TEAL = RGBColor(10, 107, 83)
MINT = RGBColor(81, 212, 168)
WHITE = RGBColor(255, 255, 255)


def set_cell_shading(cell, hex_color: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def set_cell_margins(cell, top=180, start=240, bottom=180, end=240):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for tag, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{tag}"))
        if node is None:
            node = OxmlElement(f"w:{tag}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_run(run, size: float, color=INK, bold=False, name="PingFang SC"):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.bold = bold
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)


def add_para(text, size=10.5, color=INK, bold=False, after=6, before=0, line=1.45, align=WD_ALIGN_PARAGRAPH.LEFT):
    paragraph = doc.add_paragraph()
    paragraph.alignment = align
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.space_before = Pt(before)
    paragraph.paragraph_format.line_spacing = line
    run = paragraph.add_run(text)
    set_run(run, size, color, bold)
    return paragraph


def add_heading(number: str, title: str, meta: Optional[str] = None):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(12)
    paragraph.paragraph_format.space_after = Pt(3)
    number_run = paragraph.add_run(f"{number} / ")
    set_run(number_run, 8, TEAL, True)
    title_run = paragraph.add_run(title)
    set_run(title_run, 15, INK, True)
    if meta:
        meta_run = paragraph.add_run(f"    {meta}")
        set_run(meta_run, 8, MUTED)
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), "DCE6E0")
    border.append(bottom)
    paragraph._p.get_or_add_pPr().append(border)
    return paragraph


def add_note(text: str):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_shading(cell, "EEF8F3")
    set_cell_margins(cell)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(text)
    set_run(run, 9, RGBColor(53, 83, 74))
    add_para("", size=1, after=0)


def add_picture(path: Path, caption: str, width_cm=16.2):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(6)
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.add_run().add_picture(str(path), width=Cm(width_cm))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(8)
    run = cap.add_run(caption)
    set_run(run, 8, MUTED)


doc = Document()
section = doc.sections[0]
section.page_width = Cm(21)
section.page_height = Cm(29.7)
section.top_margin = Cm(1.4)
section.bottom_margin = Cm(1.3)
section.left_margin = Cm(1.6)
section.right_margin = Cm(1.6)

normal = doc.styles["Normal"]
normal.font.name = "PingFang SC"
normal.font.size = Pt(10.5)
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "PingFang SC")

footer = section.footer.paragraphs[0]
footer.text = "QuoteSentry 报价哨兵｜Agent 赛道产品解决方案｜https://wayknow.tech/quotesentry/"
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
for run in footer.runs:
    set_run(run, 7.5, MUTED)

cover = doc.add_table(rows=1, cols=1)
cover.alignment = WD_TABLE_ALIGNMENT.CENTER
cell = cover.cell(0, 0)
set_cell_shading(cell, "07523F")
set_cell_margins(cell, top=360, start=420, bottom=360, end=420)
cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
paragraph = cell.paragraphs[0]
paragraph.paragraph_format.space_after = Pt(4)
run = paragraph.add_run("AGENT 赛道 / 产品解决方案（8 模块提交版）")
set_run(run, 8.5, MINT, True)
paragraph = cell.add_paragraph()
paragraph.paragraph_format.space_after = Pt(6)
run = paragraph.add_run("QuoteSentry 报价哨兵")
set_run(run, 28, WHITE, True)
paragraph = cell.add_paragraph()
paragraph.paragraph_format.space_after = Pt(0)
run = paragraph.add_run("面向中国高混紧固件外贸商的询价审单 Agent。把邮件和 Excel 询价逐行转成有证据、有边界、可审批的报价。")
set_run(run, 10.5, RGBColor(219, 238, 230))

add_heading("01", "作品名称与一句话定位", "≤30 字")
add_para("作品名称：QuoteSentry（报价哨兵）", 11, INK, True, after=3)
add_para("一句话定位：QuoteSentry 报价哨兵｜紧固件外贸询价审单 Agent", 11, TEAL, True, after=6)
add_note("对外展示使用 30 字定位；产品界面、视频和二维码统一使用 QuoteSentry / 报价哨兵。")

add_heading("02", "痛点场景", "93 字 / 80–100 字")
add_para("高混紧固件外贸商每天从邮件、Excel 和 PDF 中拆出多行询价，再补标准、材质、强度、表面处理和数量。缺参、写法冲突或目录外规格一旦被相似 SKU 替代，就会造成错报价、返工、空运和审批无痕。")

add_heading("03", "解决方案", "113 字 / 80–120 字")
add_para("QuoteSentry 用 Agent 逐行读取询价并回指原文，先做缺参、冲突和单位门禁，再回私有目录硬匹配 SKU，由确定性规则计算折扣、阶梯价、汇率、费用和毛利。异常行被明确阻断，模型只做抽取和解释；审批、导出和外发必须由人确认。")
add_note("边界：大模型不计算价格，不决定 SKU，不自动审批、不自动导出、不自动外发。")

doc.add_picture(str(ASSETS / "QuoteSentry-demo-qr.png"), width=Cm(3.2))
last = doc.paragraphs[-1]
last.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_para("扫码体验三轮对话：https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08", 8.5, MUTED, False, after=0, align=WD_ALIGN_PARAGRAPH.CENTER)

doc.add_page_break()
add_heading("04", "核心功能", "3 个功能 · 每个 30–50 字")

add_para("1. 逐行抽取与证据回指（40 字）", 11, TEAL, True, after=2)
add_para("每行独立识别规格、数量和异常，字段证据回到原邮件或表格位置。", 10, INK, after=3)
add_picture(ASSETS / "01-round1.png", "首轮结果：完整行可报价；缺表面处理行待澄清；目录外行明确阻断，异常行不影响其他行。")

add_para("2. 目录硬匹配与确定性计价（44 字）", 11, TEAL, True, after=2)
add_para("SKU 必须命中私有目录，价格、折扣、汇率、费用和毛利全部可复算。", 10, INK, after=3)
add_picture(ASSETS / "02-round2.png", "第二轮补充“镀锌”后写入人工证据并重算，两行可报价，整单 USD 1,592.78；第三行仍不替代。")

doc.add_page_break()
add_para("3. 三轮对话与人工审批（44 字）", 11, TEAL, True, after=2)
add_para("补参自动重算，解释阻断原因；审批、override、导出均由人确认。", 10, INK, after=3)
add_picture(ASSETS / "06-approve-modal.png", "对话只返回审批入口；负责人核对版本、金额、毛利和可报价行数后，点击按钮完成审批。")

add_heading("05", "使用流程", "99 字 / 80–100 字")
add_para("进入对话审单，发送询价或上传表格；Agent 逐行抽取并标记可报价、待澄清和目录外。补充缺失字段后自动重算，进入报价审批核对客户视图、成本和毛利。人工确认后导出客户 CSV/PDF，审计时间线记录过程。")

add_heading("06", "差异化价值", "79 字 / 60–80 字")
add_para("通用大模型能读会写，却不掌握客户目录、协议价和审批责任；人工报价依赖经验、难以追溯。模型只做抽取与解释，价格交给规则，承诺动作交给人，可阻断、可复核、可追责。")

comparison = doc.add_table(rows=1, cols=3)
comparison.style = "Table Grid"
headers = ["替代方案", "局限", "QuoteSentry 的切口"]
for index, text in enumerate(headers):
    cell = comparison.rows[0].cells[index]
    set_cell_shading(cell, "EDF8F3")
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(text)
    set_run(run, 9, TEAL, True)
for row_data in [
    ("人工 + Excel", "慢、易漏项、审批无痕", "保留表格入口，增加逐行证据和门禁"),
    ("通用大模型", "能读能写，但不保证目录、价格和责任", "模型只抽取，规则计价，人工审批"),
    ("ERP / 报价 SaaS", "依赖结构化数据和深度实施", "站在 ERP 前处理脏邮件与非标准附件"),
]:
    row = comparison.add_row()
    for index, text in enumerate(row_data):
        paragraph = row.cells[index].paragraphs[0]
        run = paragraph.add_run(text)
        set_run(run, 8.5, INK)

add_heading("07", "适用人群", "60 字 / 40–60 字")
add_para("高混紧固件外贸商的报价员、销售主管和外贸公司负责人；也适用于有私有目录、客户专属折扣和人工审批流程的五金标准件出口企业。")

add_heading("08", "Demo 与验证证据", "补充模块")
metrics = doc.add_table(rows=2, cols=2)
metrics.style = "Table Grid"
metric_data = [
    ("2:50", "参赛视频，覆盖首轮审单、补参重算、目录外解释、审批边界、导出与审计。"),
    ("4 轮", "连续有效对话：审单、补镀锌、解释阻断、请求审批；对话不自动审批。"),
    ("51 / 51", "领域、计价、对话、Worker、鉴权与导出隔离自动化测试全部通过。"),
    ("26 / 26", "字段证据回指原文；无法验证的片段不进入报价。"),
]
for index, (value, description) in enumerate(metric_data):
    cell = metrics.rows[index // 2].cells[index % 2]
    set_cell_shading(cell, "F4F8F5")
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(value)
    set_run(run, 13, TEAL, True)
    paragraph = cell.add_paragraph(description)
    for run in paragraph.runs:
        set_run(run, 8.5, MUTED)

add_para("体验入口：https://wayknow.tech/quotesentry/?tab=chat&doc=seed-08", 9.5, TEAL, True, before=8, after=2)
add_para("线上已部署 Cloudflare Worker + D1；当前默认使用 DeepSeek Flash，可切换 DeepSeek V4 Pro，正式版可按用户需求接入更多模型。演示使用仿真目录、客户和询价；客户外发已禁用。审批、导出和 override 必须由人确认。", 9, MUTED, after=4)
add_para("本材料不宣称真实客户、真实 ROI 或成交提升。当前证明的是业务闭环、证据链、异常阻断和审批责任；商业假设需在赛后用设计伙伴和脱敏询价验证。", 8.5, MUTED, after=0)

doc.core_properties.title = "QuoteSentry 报价哨兵｜Agent 赛道产品解决方案"
doc.core_properties.subject = "Agent 赛道 8 模块产品解决方案"
doc.core_properties.author = "QuoteSentry"
doc.save(OUTPUT)
print(OUTPUT)
