'use strict';

const { dialog, BrowserWindow } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const MarkdownIt = require('markdown-it');

const mdParser = new MarkdownIt({ html: true, linkify: true, typographer: true });

const PAGE_SIZES = {
  'A4':     { width: 794,  height: 1123, electron: 'A4'     },
  'A3':     { width: 1123, height: 1587, electron: 'A3'     },
  'Letter': { width: 816,  height: 1056, electron: 'Letter' },
  'Legal':  { width: 816,  height: 1344, electron: 'Legal'  },
};

async function exportPdf(renderedHtml, cssText, defaultName, sourceFilePath = '') {
  const sizeNames = Object.keys(PAGE_SIZES);
  const { response: sizeIdx } = await dialog.showMessageBox({
    type: 'question',
    buttons: [...sizeNames, 'Cancel'],
    defaultId: 0,
    cancelId: sizeNames.length,
    title: 'Export PDF',
    message: 'Select page size',
  });
  if (sizeIdx === sizeNames.length) return { success: false, canceled: true };
  const pageSize = PAGE_SIZES[sizeNames[sizeIdx]];

  const defaultDir = sourceFilePath ? path.dirname(sourceFilePath) : '';
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(defaultDir || '.', defaultName + '.pdf'),
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };

  const html = [
    '<!doctype html><html><head>',
    '<meta charset="utf-8">',
    `<title>${defaultName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>`,
    '<style>', cssText.replace(/<\/style/gi, '<\\/style'), '</style>',
    '<style>',
    // styles.css sets body{height:100vh;overflow:hidden;display:flex} which clips content to 1 page.
    // Reset all app-shell layout constraints so printToPDF sees the full document.
    'html,body{height:auto!important;min-height:0!important;overflow:visible!important;display:block!important;background:#fff!important;color:#000!important;margin:0;padding:0}',
    '.preview{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;overflow:visible!important;padding:0.5in!important;box-sizing:border-box!important;font-size:11pt;line-height:1.6}',
    // Fix table scroll-container → real table so columns don't stack
    '.preview table{display:table!important;overflow-x:visible!important;width:100%!important;table-layout:fixed}',
    '.preview td,.preview th{word-break:break-word;overflow-wrap:break-word}',
    // Page break hints
    '.preview pre{page-break-inside:avoid}',
    '.preview h1,.preview h2,.preview h3{page-break-after:avoid}',
    '</style>',
    '</head><body>',
    '<div class="preview">', renderedHtml, '</div>',
    '</body></html>',
  ].join('\n');

  const tmpHtml = path.join(os.tmpdir(), `mdviewer-${Date.now()}.html`);
  let win = null;
  try {
    await fs.writeFile(tmpHtml, html, 'utf8');
    win = new BrowserWindow({
      show: false,
      width: pageSize.width,
      height: pageSize.height,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await win.loadFile(tmpHtml);
    await new Promise(r => setTimeout(r, 400));
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: false,
      pageSize: pageSize.electron,
      marginsType: 1,
    });
    await fs.writeFile(filePath, pdfBuffer);
    return { success: true, savedPath: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    if (win && !win.isDestroyed()) win.close();
    fs.unlink(tmpHtml).catch(() => {});
  }
}

async function exportHtml(renderedHtml, cssText, defaultName, sourceFilePath = '') {
  const defaultDir = sourceFilePath ? path.dirname(sourceFilePath) : '';
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(defaultDir || '.', defaultName + '.html'),
    filters: [{ name: 'HTML File', extensions: ['html'] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    const html = [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${defaultName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>`,
      '<style>',
      cssText.replace(/<\/style/gi, '<\\/style'),
      '</style>',
      '</head>',
      '<body>',
      '<div class="preview" style="max-width:860px;margin:0 auto;padding:40px 24px">',
      renderedHtml,
      '</div>',
      '</body>',
      '</html>',
    ].join('\n');
    await fs.writeFile(filePath, html, 'utf8');
    return { success: true, savedPath: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function exportDocx(markdown, defaultName, sourceFilePath = '') {
  const {
    Document, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, Packer, BorderStyle,
  } = require('docx');

  const defaultDir = sourceFilePath ? path.dirname(sourceFilePath) : '';
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(defaultDir || '.', defaultName + '.docx'),
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    const tokens = mdParser.parse(markdown, {});
    const elements = [];
    let hasOrderedList = false;

    function inlineToRuns(inlineToken, base = {}) {
      if (!inlineToken || !inlineToken.children) return [new TextRun({ text: '' })];
      const runs = [];
      let bold = false, italics = false, strike = false;
      for (const child of inlineToken.children) {
        if (child.type === 'strong_open') bold = true;
        else if (child.type === 'strong_close') bold = false;
        else if (child.type === 'em_open') italics = true;
        else if (child.type === 'em_close') italics = false;
        else if (child.type === 's_open') strike = true;
        else if (child.type === 's_close') strike = false;
        else if (child.type === 'code_inline') {
          runs.push(new TextRun({ text: child.content, font: 'Courier New', size: 20 }));
        } else if (child.type === 'text' || child.type === 'softbreak') {
          const text = child.type === 'softbreak' ? ' ' : child.content;
          runs.push(new TextRun({
            text,
            bold: bold || !!base.bold,
            italics: italics || !!base.italics,
            strike: strike || !!base.strike,
          }));
        }
      }
      return runs.length ? runs : [new TextRun({ text: '' })];
    }

    const H_LEVEL = {
      h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2,
      h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4,
      h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
    };

    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];

      if (t.type === 'heading_open') {
        if (i + 2 < tokens.length) {
          elements.push(new Paragraph({ children: inlineToRuns(tokens[i + 1]), heading: H_LEVEL[t.tag] || HeadingLevel.HEADING_1 }));
        }
        i += 3; continue;
      }

      if (t.type === 'paragraph_open') {
        if (i + 2 < tokens.length) {
          elements.push(new Paragraph({ children: inlineToRuns(tokens[i + 1]) }));
        }
        i += 3; continue;
      }

      if (t.type === 'fence') {
        const lines = t.content.replace(/\n$/, '').split('\n');
        for (const line of lines) {
          elements.push(new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 20 })],
            shading: { type: 'clear', color: 'auto', fill: 'F3F4F6' },
          }));
        }
        i++; continue;
      }

      if (t.type === 'hr') {
        elements.push(new Paragraph({
          children: [new TextRun({ text: '' })],
          border: { bottom: { color: 'D0D7DE', space: 1, style: BorderStyle.SINGLE, size: 6 } },
        }));
        i++; continue;
      }

      if (t.type === 'bullet_list_open') {
        i++;
        while (i < tokens.length && tokens[i].type !== 'bullet_list_close') {
          if (tokens[i].type === 'list_item_open') {
            i++;
            while (i < tokens.length && tokens[i].type !== 'list_item_close') {
              if (tokens[i].type === 'paragraph_open') {
                elements.push(new Paragraph({ children: inlineToRuns(tokens[i + 1]), bullet: { level: 0 } }));
                i += 3;
              } else if (tokens[i].type === 'inline') {
                elements.push(new Paragraph({ children: inlineToRuns(tokens[i]), bullet: { level: 0 } }));
                i++;
              } else { i++; }
            }
          }
          i++;
        }
        i++; continue;
      }

      if (t.type === 'ordered_list_open') {
        hasOrderedList = true;
        i++;
        while (i < tokens.length && tokens[i].type !== 'ordered_list_close') {
          if (tokens[i].type === 'list_item_open') {
            i++;
            while (i < tokens.length && tokens[i].type !== 'list_item_close') {
              if (tokens[i].type === 'paragraph_open') {
                elements.push(new Paragraph({ children: inlineToRuns(tokens[i + 1]), numbering: { reference: 'default-numbering', level: 0 } }));
                i += 3;
              } else if (tokens[i].type === 'inline') {
                elements.push(new Paragraph({ children: inlineToRuns(tokens[i]), numbering: { reference: 'default-numbering', level: 0 } }));
                i++;
              } else { i++; }
            }
          }
          i++;
        }
        i++; continue;
      }

      if (t.type === 'blockquote_open') {
        i++;
        while (i < tokens.length && tokens[i].type !== 'blockquote_close') {
          if (tokens[i].type === 'paragraph_open') {
            elements.push(new Paragraph({
              children: inlineToRuns(tokens[i + 1], { italics: true }),
              indent: { left: 720 },
              border: { left: { color: 'D0D7DE', space: 8, style: BorderStyle.SINGLE, size: 12 } },
            }));
            i += 3;
          } else { i++; }
        }
        i++; continue;
      }

      if (t.type === 'table_open') {
        i++;
        const tableRows = [];
        let inThead = false;
        while (i < tokens.length && tokens[i].type !== 'table_close') {
          if (tokens[i].type === 'thead_open') { inThead = true; i++; continue; }
          if (tokens[i].type === 'thead_close') { inThead = false; i++; continue; }
          if (tokens[i].type === 'tbody_open' || tokens[i].type === 'tbody_close') { i++; continue; }
          if (tokens[i].type === 'tr_open') {
            const cells = [];
            i++;
            while (i < tokens.length && tokens[i].type !== 'tr_close') {
              if (tokens[i].type === 'th_open' || tokens[i].type === 'td_open') {
                const isHead = tokens[i].type === 'th_open';
                cells.push(new TableCell({
                  children: [new Paragraph({ children: inlineToRuns(tokens[i + 1]) })],
                  shading: isHead ? { type: 'clear', color: 'auto', fill: 'F6F8FA' } : undefined,
                }));
                i += 3;
              } else { i++; }
            }
            tableRows.push(new TableRow({ children: cells, tableHeader: inThead }));
          }
          i++;
        }
        if (tableRows.length) {
          elements.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        }
        i++; continue;
      }

      i++;
    }

    const docConfig = { sections: [{ children: elements }] };

    if (hasOrderedList) {
      docConfig.numbering = {
        config: [{
          reference: 'default-numbering',
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'left' }],
        }],
      };
    }

    const doc = new Document(docConfig);
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(filePath, buffer);
    return { success: true, savedPath: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { exportPdf, exportHtml, exportDocx };
