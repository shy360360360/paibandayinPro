import { LINE_STYLES, COMPONENT_TYPES } from '../constants';
import { formatUtils } from '../utils';
import { allFields, invoiceDataByCustomer, layoutComponents } from '../store';
import { useData } from './useData';

export function usePrint() {
    // 引入计算函数
    const { calculateVariables } = useData();

    function replaceVariables(text, customerData) {
        if (!text) return '';
        
        // 针对当前的 customerData 实时计算变量
        const calculationResults = calculateVariables(customerData);

        let res = text.replace(/\\n/g, '<br>').replace(/\\t/g, '&nbsp;&nbsp;');
        
        if (!customerData) {
             // 如果没有数据（编辑模式），直接替换空格为 &nbsp; 并返回，确保空格显示
             return res.replace(/ /g, '&nbsp;');
        }

        // 1. 处理被@包裹的变量（转中文大写）
        res = res.replace(/@(\\{\\{[^}]+\\}\\})@/g, (match, variable) => {
            let val = resolveVariableContent(variable, calculationResults, customerData);
            const num = parseFloat(val);
            return isNaN(num) ? val : formatUtils.chineseAmount(num);
        });

        // 2. 处理被@包裹的纯数字
        res = res.replace(/@(\d+(\.\d+)?)@/g, (m, n) => formatUtils.chineseAmount(parseFloat(n)));

        // 3. 处理剩余的所有普通变量引用
        res = resolveVariableContent(res, calculationResults, customerData);

        // [核心修复] 最后将剩余的普通空格转换为 &nbsp;，确保格式保留
        return res.replace(/ /g, '&nbsp;');
    }

    // 辅助函数：解析 {{...}} 内容
    function resolveVariableContent(text, calculationResults, customerData) {
        let processed = text;

        // A. 处理带索引的计算结果引用: {{ 变量[0] }}
        processed = processed.replace(/\{\{\s*([^}\s\[\]]+)\s*\[\s*(\d+)\s*\]\s*\}\}/g, (match, varName, indexStr) => {
            const trimmedVarName = varName.trim();
            const index = parseInt(indexStr, 10);
            
            if (calculationResults && 
                calculationResults[trimmedVarName] && 
                Array.isArray(calculationResults[trimmedVarName].values) &&
                calculationResults[trimmedVarName].values[index] !== undefined) {
                
                const val = calculationResults[trimmedVarName].values[index];
                const config = calculationResults[trimmedVarName].config;
                return formatUtils.numberConfig(val, config);
            }
            return ''; 
        });

        // B. 处理普通变量引用: {{ 变量 }}
        processed = processed.replace(/\{\{\s*([^}\s\[\]]+)\s*\}\}/g, (match, varName) => {
            const trimmedVarName = varName.trim();

            if (calculationResults && 
                calculationResults[trimmedVarName] && 
                Array.isArray(calculationResults[trimmedVarName].values) &&
                calculationResults[trimmedVarName].values.length > 0) {
                
                const val = calculationResults[trimmedVarName].values[0];
                const config = calculationResults[trimmedVarName].config;
                return formatUtils.numberConfig(val, config);
            }

            const field = allFields.value.find(f => f.name === trimmedVarName);
            if (field) {
                if (customerData.groupingInfo) {
                    const groupItem = customerData.groupingInfo.find(g => g.name === trimmedVarName);
                    if (groupItem) return groupItem.value || '';
                }
                if (customerData.records && customerData.records.length > 0) {
                    return formatUtils.cell(customerData.records[0][field.id]) || '';
                }
            }
            return ''; 
        });

        return processed;
    }

    function getStrokeDashArray(style) {
        const styleObj = LINE_STYLES.find(s => s.value === style);
        return styleObj ? styleObj.dashArray : 'none';
    }

    // [新增] 日期格式化
    function formatDate(format) {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const second = String(d.getSeconds()).padStart(2, '0');
        
        return (format || 'YYYY-MM-DD')
            .replace('YYYY', year).replace('MM', month).replace('DD', day)
            .replace('HH', hour).replace('mm', minute).replace('ss', second);
    }

    // [核心修改] 增加 pageIndex 和 totalPages 参数
    function renderComponentContent(comp, data, isEditMode, pageIndex = 0, totalPages = 1) {
        if (!comp) return '';
        
        // 1. 绘图类 (SVG)
        if (comp.type === COMPONENT_TYPES.DRAW_LINE) {
            const dashArray = getStrokeDashArray(comp.style.strokeStyle);
            return `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible"><line x1="${comp.x}" y1="${comp.y}" x2="${comp.w}" y2="${comp.h}" stroke="${comp.style.strokeColor}" stroke-width="${comp.style.strokeWidth}" stroke-dasharray="${dashArray}" /></svg>`;
        }
        if (comp.type === COMPONENT_TYPES.DRAW_PATH) {
            const dashArray = getStrokeDashArray(comp.style.strokeStyle);
            return `<svg style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible"><path d="${comp.d}" stroke="${comp.style.strokeColor}" stroke-width="${comp.style.strokeWidth}" stroke-dasharray="${dashArray}" fill="none" /></svg>`;
        }
        
        // [新增] 形状类 (SVG)
        if (comp.type === COMPONENT_TYPES.SHAPE_RECT) {
             const s = comp.style;
             const dashArray = getStrokeDashArray(s.strokeStyle);
             return `<svg style="width:100%;height:100%;display:block;overflow:visible;"><rect x="0" y="0" width="100%" height="100%" rx="${s.borderRadius||0}" fill="${s.fillColor||'none'}" stroke="${s.strokeColor||'#000'}" stroke-width="${s.strokeWidth||1}" stroke-dasharray="${dashArray}" vector-effect="non-scaling-stroke" /></svg>`;
        }
        if (comp.type === COMPONENT_TYPES.SHAPE_CIRCLE) {
             const s = comp.style;
             const dashArray = getStrokeDashArray(s.strokeStyle);
             return `<svg style="width:100%;height:100%;display:block;overflow:visible;"><ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="${s.fillColor||'none'}" stroke="${s.strokeColor||'#000'}" stroke-width="${s.strokeWidth||1}" stroke-dasharray="${dashArray}" vector-effect="non-scaling-stroke" /></svg>`;
        }
        
        // [新增] 分割线 (SVG)
        if (comp.type === COMPONENT_TYPES.DIVIDER) {
            const s = comp.style;
            const dashArray = getStrokeDashArray(s.strokeStyle);
            const isV = comp.orientation === 'v';
            const x1 = isV ? '50%' : '0%';
            const y1 = isV ? '0%' : '50%';
            const x2 = isV ? '50%' : '100%';
            const y2 = isV ? '100%' : '50%';
            return `<svg style="width:100%;height:100%;display:block;overflow:visible;"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s.strokeColor||'#000'}" stroke-width="${s.strokeWidth||1}" stroke-dasharray="${dashArray}" /></svg>`;
        }

        // 2. 二维码 & 图片
        if (comp.type === COMPONENT_TYPES.QR_CODE) {
            const val = replaceVariables(comp.content, data) || '123456';
            return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(val)}" style="width:100%;height:100%;display:block;"/>`;
        }
        if (comp.type === COMPONENT_TYPES.IMAGE) {
            return `<img src="${comp.src}" style="width:100%; height:100%; object-fit: ${comp.style.objectFit || 'contain'}; display:block;" />`;
        }

        // 3. 通用文本样式生成
        const s = comp.style || {};
        let baseStyle = `
            font-size: ${s.fontSize||12}px; 
            font-weight: ${s.fontWeight||'normal'}; 
            text-align: ${s.textAlign||'left'}; 
            color: ${s.color||'#000'}; 
            line-height: ${s.lineHeight||1.4}; 
            white-space: ${s.whiteSpace||'normal'}; 
            width: 100%; height: 100%; overflow: hidden;
            box-sizing: border-box;
        `;
        
        if (s.backgroundColor) baseStyle += `background-color: ${s.backgroundColor};`;
        if (s.borderWidth && s.borderStyle && s.borderStyle !== 'none') {
            baseStyle += `border: ${s.borderWidth}px ${s.borderStyle} ${s.borderColor};`;
            if (s.borderRadius) baseStyle += `border-radius: ${s.borderRadius}px;`;
        }
        if (s.padding) baseStyle += `padding: ${s.padding}px;`;

        // 4. 各类文本组件
        if (comp.type === COMPONENT_TYPES.TITLE) {
            return `<div style="${baseStyle} display:flex; align-items:center; justify-content:${s.textAlign||'center'}">${replaceVariables(comp.content, data)}</div>`;
        }
        if (comp.type === COMPONENT_TYPES.TEXT_ROW || comp.type === COMPONENT_TYPES.RICH_TEXT) {
            return `<div style="${baseStyle}">${replaceVariables(comp.content, data)}</div>`;
        }
        
        if (comp.type === COMPONENT_TYPES.V_TEXT) {
            const vStyle = `writing-mode: vertical-rl; text-orientation: upright; letter-spacing: ${s.letterSpacing||0}px; display: flex; align-items: ${s.textAlign === 'center' ? 'center' : (s.textAlign === 'right' ? 'flex-end' : 'flex-start')};`;
            return `<div style="${baseStyle} ${vStyle}">${replaceVariables(comp.content, data)}</div>`;
        }

        if (comp.type === COMPONENT_TYPES.DATETIME) {
            const timeStr = comp.autoCurrent ? formatDate(comp.format) : (replaceVariables(comp.content, data) || formatDate(comp.format));
            return `<div style="${baseStyle} display:flex; align-items:center; justify-content:${getFlexAlign(s.textAlign)}">${timeStr}</div>`;
        }

        // [修正] 页码 - 变量替换逻辑增强 (支持空格和大小写)
        if (comp.type === COMPONENT_TYPES.PAGE_NUMBER) {
             let content = comp.format || '第 {{page}} 页';
             // 替换 {{page}} 和 {{total}}，使用正则 \s* 允许空格，gi 忽略大小写
             content = content.replace(/\{\{\s*page\s*\}\}/gi, pageIndex + 1)
                              .replace(/\{\{\s*total\s*\}\}/gi, totalPages);
             
             return `<div style="${baseStyle} display:flex; align-items:center; justify-content:${getFlexAlign(s.textAlign)}">${content}</div>`;
        }
        
        // [新增] 签名区
        if (comp.type === COMPONENT_TYPES.SIGNATURE) {
            const label = replaceVariables(comp.label, data);
            const dateStr = comp.showDate ? '日期：' : '';
            return `
                <div style="${baseStyle} display:flex; align-items:flex-end; white-space:nowrap;">
                    <span style="flex-shrink:0;">${label}</span>
                    <div style="flex:1; border-bottom:1px solid #000; margin:0 4px; height:1px; align-self:flex-end;"></div>
                    ${ comp.showDate ? `<span style="flex-shrink:0; margin-left:12px;">${dateStr}</span><div style="width:80px; border-bottom:1px solid #000; margin-left:4px; height:1px; align-self:flex-end;"></div>` : '' }
                </div>
            `;
        }

        if (comp.type === COMPONENT_TYPES.CHECKBOX) {
            const isChecked = comp.checked;
            const checkMark = isChecked ? `<path d="M3 6 L6 9 L11 3" stroke="currentColor" stroke-width="2" fill="none" />` : '';
            return `
                <div style="${baseStyle} display:flex; align-items:center;">
                    <svg width="14" height="14" viewBox="0 0 14 14" style="margin-right:4px; border:1px solid currentColor; border-radius:2px; flex-shrink:0;">
                        ${checkMark}
                    </svg>
                    <span>${replaceVariables(comp.content, data)}</span>
                </div>
            `;
        }
        
        // 5. 表格组件
        if (comp.type === COMPONENT_TYPES.TABLE) {
            const cols = comp.selectedFieldIds.map(id => allFields.value.find(f => f.id === id)).filter(Boolean);
            if(comp.selectedFieldIds.length === 0) return `<div style="color:red; border:1px dashed red; padding: 10px; font-size:12px;">请配置表格列</div>`;
            const widths = comp.columnWidths ? comp.columnWidths.split(',').map(w => Number(w)) : [];
            const totalW = widths.reduce((a,b)=>a+b, 0);
            
            const rowH = comp.rowHeight || 36;
            const dataFs = comp.dataFontSize || 12;
            
            const tdStyle = `border: 1px solid #000; height: ${rowH}px; padding: 0; box-sizing: border-box; vertical-align: middle;`;
            let justify = 'flex-start';
            if (comp.dataAlign === 'center') justify = 'center';
            if (comp.dataAlign === 'right') justify = 'flex-end';

            const innerDivStyle = `width: 100%; height: 100%; display: flex; align-items: center; justify-content: ${justify}; padding: 0 0.4em; overflow: hidden; white-space: nowrap; font-size: ${dataFs}px;`;

            const thStyle = `border: 1px solid #000; padding: 0; background-color: #f8f9fa; font-weight: 600; height:${rowH}px; box-sizing:border-box;`;
            const thInnerStyle = `width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 0.4em; overflow: hidden; white-space: nowrap; font-size: ${dataFs}px;`;

            let ths = ''; 
            cols.forEach((col, i) => { 
                const wStyle = (totalW > 0 && widths[i]) ? `width:${(widths[i]/totalW)*100}%` : `width:${100/cols.length}%`;
                ths += `<th style="${wStyle}; ${thStyle}"><div style="${thInnerStyle}">${col.name}</div></th>`; 
            });
            
            let trs = '';
            const buildTd = (content) => `<td style="${tdStyle}"><div style="${innerDivStyle}">${content}</div></td>`;

            if (isEditMode) { 
                trs += '<tr>' + cols.map(c => buildTd(`{{${c.name}}}`)).join('') + '</tr>'; 
            } else {
                 if(data.records && data.records.length) {
                     data.records.forEach(rec => { 
                         trs += '<tr>' + cols.map(c => buildTd(formatUtils.cell(rec[c.id]))).join('') + '</tr>'; 
                     });
                 }
            }
            
            const emptyRowCount = (comp.emptyRows !== undefined && comp.emptyRows !== null) ? comp.emptyRows : 0;
            for(let i=0; i<emptyRowCount; i++) {
                trs += `<tr>${cols.map(() => buildTd('&nbsp;')).join('')}</tr>`;
            }
            
            if(comp.showSummary && comp.summaryConfig) {
                const summaryInner = (text, align) => `<div style="flex:1; text-align:${align}; overflow:hidden; white-space:nowrap;">${text}</div>`;
                const sumLeft = replaceVariables(comp.summaryConfig.left, data);
                const sumCenter = replaceVariables(comp.summaryConfig.center, data);
                const sumRight = replaceVariables(comp.summaryConfig.right, data);

                const sumContent = `
                    <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:space-between; padding:0 0.4em; font-size:${dataFs}px;">
                        ${summaryInner(sumLeft, 'left')}
                        ${summaryInner(sumCenter, 'center')}
                        ${summaryInner(sumRight, 'right')}
                    </div>`;
                trs += `<tr><td colspan="${cols.length}" style="${tdStyle}">${sumContent}</td></tr>`;
            }
            return `<table style="width:100%; border-collapse:collapse; table-layout: fixed;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
        }
        return '';
    }

    function getFlexAlign(textAlign) {
        if (textAlign === 'center') return 'center';
        if (textAlign === 'right') return 'flex-end';
        return 'flex-start';
    }

    function print() {
        const styles = `@page { size: A4; margin: 0; } body { margin: 0; font-family: "Helvetica Neue", Helvetica, sans-serif; -webkit-print-color-adjust: exact; } .page { width: 794px; height: 1123px; margin: 0 auto; position: relative; page-break-after: always; overflow: hidden; } .page:last-child { page-break-after: auto; } .comp { position: absolute; overflow: hidden; }`;
        let htmlContent = '';
        
        // [核心修改] 获取总页数
        const totalPages = invoiceDataByCustomer.value.length;
        
        invoiceDataByCustomer.value.forEach((data, idx) => {
            let pageHtml = '<div class="page">';
            layoutComponents.value.forEach(comp => {
                let style = '';
                if (comp.type === COMPONENT_TYPES.DRAW_LINE || comp.type === COMPONENT_TYPES.DRAW_PATH) {
                    style = `left:0; top:0; width:100%; height:100%; z-index:${comp.style?.zIndex||10}; pointer-events:none;`;
                } else {
                    const hStyle = comp.type === COMPONENT_TYPES.TABLE ? 'auto' : comp.h + 'px';
                    style = `left:${comp.x}px; top:${comp.y}px; width:${comp.w}px; height:${hStyle}; z-index:${comp.style?.zIndex||0};`;
                }
                // [核心修改] 传递 idx (pageIndex) 和 totalPages
                pageHtml += `<div class="comp" style="${style}">${renderComponentContent(comp, data, false, idx, totalPages)}</div>`;
            });
            pageHtml += '</div>';
            htmlContent += pageHtml;
        });

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.write(`<html><head><title>Print</title><style>${styles}</style></head><body>${htmlContent}</body></html>`);
        doc.close();
        iframe.contentWindow.focus();
        iframe.onload = () => {
            setTimeout(() => { iframe.contentWindow.print(); document.body.removeChild(iframe); }, 100);
        };
    }

    return { print, renderComponentContent, getStrokeDashArray };
}