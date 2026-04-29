'use strict';

const { dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const MarkdownIt = require('markdown-it');

const mdParser = new MarkdownIt({ html: true, linkify: true, typographer: true });

function runPandoc(args) {
  return new Promise((resolve, reject) => {
    execFile('pandoc', args, { windowsHide: true, timeout: 30000 }, (err, _stdout, stderr) => {
      if (err) {
        const msg = err.code === 'ENOENT'
          ? 'Pandoc is not installed.\n\nDownload from: https://pandoc.org/installing.html\n\nAfter installing, restart the app.'
          : (stderr || err.message);
        reject(new Error(msg));
      } else {
        resolve();
      }
    });
  });
}

async function exportPdf(markdown, defaultName) {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName + '.pdf',
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };

  const tmpMd = path.join(os.tmpdir(), `mdviewer-${Date.now()}.md`);
  try {
    await fs.writeFile(tmpMd, markdown, 'utf8');
    await runPandoc([
      tmpMd,
      '-o', filePath,
      '--standalone',
      '-V', 'geometry:margin=1in',
      '-V', 'colorlinks=true',
      '-V', 'linkcolor=blue',
    ]);
    return { success: true, savedPath: filePath };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    fs.unlink(tmpMd).catch(() => {});
  }
}

async function exportHtml(renderedHtml, cssText, defaultName) {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName + '.html',
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

async function exportDocx(markdown, defaultName) {
  const {
    Document, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, Packer, BorderStyle,
  } = require('docx');

  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName + '.docx',
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
