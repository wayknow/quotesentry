# QuoteSentry 一页纸

- 源文件：`pitch/index.html`
- 产品截图：`pitch/assets/quote-sentry-demo.png`
- 输出：`demo/QuoteSentry-one-pager.pdf`
- 预览：`demo/QuoteSentry-one-pager.png`

版式为 A4 单页，内容对应 `docs/PITCH.md`。已用 Chrome 渲染并经 Quick Look 检查，PDF 严格 1 页、无裁切。所有客户、SKU、价格和询价均为仿真数据，不宣称真实客户 ROI。

重新生成 PDF：

```bash
# 需要本机 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=demo/QuoteSentry-one-pager.pdf \
  "file://$(pwd)/pitch/index.html"
```

重新生成 PNG 预览：

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --hide-scrollbars \
  --window-size=794,1123 --force-device-scale-factor=2 \
  --screenshot=demo/QuoteSentry-one-pager.png \
  "file://$(pwd)/pitch/index.html"
```
