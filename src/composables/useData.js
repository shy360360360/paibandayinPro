import { watch } from 'vue'; 
import { bitable } from '@lark-base-open/js-sdk';
import { 
    globalSettings, allFields, invoiceDataByCustomer, calculationResults, 
    allTableList, templateManager, currentTableId, currentViewId 
} from '../store';
import { formatUtils, evaluateExpression, safeFloat } from '../utils';

let lastRecordIdList = [];
let lastViewId = null;
let isFetching = false; // 防止竞态

export function useData() {
    
    // --- 逻辑 1: 公式计算 (解耦纯计算逻辑) ---
    const calculateVariables = (customerData) => {
        const results = {};
        if (!globalSettings.value.calculationFormulas || !customerData || !customerData.records || !customerData.records.length) { 
            return results; 
        }
        
        const formulas = globalSettings.value.calculationFormulas.split(';').map(f => f.trim()).filter(f => f);
        
        formulas.forEach(formula => {
            // 解析公式：变量名(格式) = 表达式
            const match = formula.match(/^([^=()]+(?:[^)]+)?)\s*=\s*(.+)$/);
            if (!match) return;
            
            const varDef = match[1].trim();
            const expression = match[2].trim();
            let varName = varDef;
            let formatConfig = null;
            
            const formatMatch = varDef.match(/^([^(]+)\(([^)]+)\)$/);
            if (formatMatch) { varName = formatMatch[1].trim(); formatConfig = formatMatch[2].trim(); }

            // 1. 列求和 (Sum) logic: "金额+"
            if (expression.endsWith('+') && !expression.includes('+ ')) {
                const fieldName = expression.slice(0, -1).trim();
                const field = allFields.value.find(f => f.name === fieldName);
                if (field) {
                    const sum = customerData.records.reduce((acc, r) => { 
                        const val = safeFloat(formatUtils.cell(r[field.id])); 
                        return acc + val; 
                    }, 0);
                    results[varName] = { values: [sum], config: formatConfig };
                }
                return;
            }
            
            // 2. 列乘积 (Product) logic: "数量*" (较少用，但保留)
            if (expression.endsWith('*') && !expression.includes('* ')) {
                const fieldName = expression.slice(0, -1).trim();
                const field = allFields.value.find(f => f.name === fieldName);
                if (field) {
                    const product = customerData.records.reduce((acc, r) => { 
                        const val = safeFloat(formatUtils.cell(r[field.id]), 1); 
                        return acc * val; 
                    }, 1);
                    results[varName] = { values: [product], config: formatConfig };
                }
                return;
            }

            // 3. 行内计算 (Row expression) logic
            const rowResults = [];
            customerData.records.forEach((record) => {
                try {
                    const fieldValues = {};
                    const expressionFields = [];
                    // 找出表达式中用到的字段
                    allFields.value.forEach(field => {
                        // 转义正则特殊字符
                        const escapedFieldName = field.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const fieldRegex = new RegExp(`(?:^|\\s|[\\(\\)+\\-*/])${escapedFieldName}(?:$|\\s|[\\(\\)+\\-*/])`, 'g');
                        if (fieldRegex.test(' ' + expression + ' ')) { expressionFields.push(field); }
                    });

                    // 提取字段值
                    expressionFields.forEach(field => {
                        if (record && record[field.id] !== undefined) {
                            const rawValue = formatUtils.cell(record[field.id]);
                            fieldValues[field.name] = safeFloat(rawValue);
                        } else { 
                            fieldValues[field.name] = 0; 
                        }
                    });

                    let evaluatedExpression = expression;
                    // 按名称长度降序排序，防止部分匹配 (e.g. "Total" vs "TotalAmount")
                    const sortedFieldNames = Object.keys(fieldValues).sort((a, b) => b.length - a.length);
                    
                    sortedFieldNames.forEach(fieldName => {
                        const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(^|\\s|[\\(\\)+\\-*/])${escapedFieldName}($|\\s|[\\(\\)+\\-*/])`, 'g');
                        // 替换为数值
                        evaluatedExpression = evaluatedExpression.replace(regex, `$1${fieldValues[fieldName]}$2`);
                    });

                    const res = evaluateExpression(evaluatedExpression);
                    rowResults.push(res);
                } catch (e) { 
                    console.error(`计算行公式 ${varName} 出错`, e); 
                    rowResults.push(0); 
                }
            });
            results[varName] = { values: rowResults, config: formatConfig };
        });
        return results;
    };

    const fetchTableList = async () => {
        try {
            const tableList = await bitable.base.getTableList();
            allTableList.value = await Promise.all(tableList.map(async table => {
                return { id: table.id, name: await table.getName() };
            }));
        } catch (e) { console.error('获取表格列表失败', e); }
    };

    // --- 逻辑 2: 数据处理 (Data Processing) ---
    // 将原始 recordIdList 转换为分组后的数据结构
    const processRecordList = async (table, recordIdList) => {
        if (!recordIdList || recordIdList.length === 0) return [];

        const groupingFields = globalSettings.value.groupingFieldIds;
        let processedData = [];

        try {
            if (groupingFields.length > 0) {
                const fields = groupingFields.map(id => allFields.value.find(f => f.id === id)).filter(Boolean);
                const groupMap = {};
                
                // 批量处理或逐个处理（API限制通常建议逐个或分页）
                for (const rid of recordIdList) {
                    const r = await table.getRecordById(rid);
                    // 提取分组 Key
                    const gVals = fields.map(f => ({ name: f.name, value: formatUtils.cell(r.fields[f.id]) || '无' }));
                    const key = gVals.map(g => g.value).join('#');
                    
                    if(!groupMap[key]) groupMap[key] = { groupingInfo: gVals, records: [] };
                    groupMap[key].records.push(r.fields);
                }
                processedData = Object.values(groupMap);
            } else {
                for (const rid of recordIdList) { 
                    const r = await table.getRecordById(rid); 
                    // 不分组模式：每一行也是一个独立的“页”概念
                    processedData.push({ groupingInfo: [], records: [r.fields] }); 
                }
            }
        } catch (error) {
            console.error('处理记录数据时出错:', error);
            return [];
        }
        return processedData;
    };

    // --- 逻辑 3: 数据加载 (Data Loading) ---
    const loadData = async (forceUpdate = false) => {
        if (isFetching) return;
        isFetching = true;

        try {
            const selection = await bitable.base.getSelection();
            if (!selection || !selection.tableId) {
                // 如果没有选中表，清空数据
                invoiceDataByCustomer.value = [];
                isFetching = false;
                return;
            }

            // 更新全局当前状态
            currentTableId.value = selection.tableId;
            currentViewId.value = selection.viewId;

            // 检查是否切换了视图
            if (selection.viewId !== lastViewId) {
                lastViewId = selection.viewId;
                templateManager.autoSwitchByViewId(selection.viewId);
                
                const table = await bitable.base.getTable(selection.tableId);
                allFields.value = await table.getFieldMetaList();
                // 视图切换强制刷新
                forceUpdate = true;
            }

            const table = await bitable.base.getTable(selection.tableId);
            const view = await table.getViewById(selection.viewId);
            const recordIdList = await view.getSelectedRecordIdList();
            
            // 如果不是强制更新，且选区没变，则跳过
            if (!forceUpdate && JSON.stringify(recordIdList) === JSON.stringify(lastRecordIdList)) {
                isFetching = false;
                return;
            }
            
            lastRecordIdList = recordIdList;
            
            if (!recordIdList.length) { 
                invoiceDataByCustomer.value = []; 
            } else {
                invoiceDataByCustomer.value = await processRecordList(table, recordIdList);
            }

        } catch (e) {
            console.error('加载数据失败:', e);
        } finally {
            isFetching = false;
        }
    };

    // 监听分页字段变化，强制刷新数据
    watch(() => globalSettings.value.groupingFieldIds, () => {
        loadData(true); 
    }, { deep: true });

    const initData = async () => {
        await fetchTableList(); 
        const table = await bitable.base.getActiveTable();
        allFields.value = await table.getFieldMetaList();
        
        const selection = await bitable.base.getSelection();
        if (selection && selection.viewId) {
            currentTableId.value = selection.tableId;
            currentViewId.value = selection.viewId;
            lastViewId = selection.viewId;
            templateManager.autoSwitchByViewId(selection.viewId);
        }

        await loadData(true);
        // 使用轮询检测选区变化 (JS SDK 目前推荐方式)
        setInterval(() => loadData(false), 1000); 
    };

    return { initData, loadData, calculateVariables };
}