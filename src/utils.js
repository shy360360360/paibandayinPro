// --- 基础工具 ---
export const uuid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// 安全的浮点数转换，防止 NaN
export const safeFloat = (val, defaultVal = 0) => {
    const n = parseFloat(val);
    return isFinite(n) ? n : defaultVal;
};

// 检查是否为有效数字
export const isValidNumber = (val) => typeof val === 'number' && isFinite(val);

// --- 格式化工具 ---
export const formatUtils = {
    cell: (cellValue) => {
        if (cellValue === undefined || cellValue === null) return '';
        // 处理时间戳
        if (typeof cellValue === 'number' && String(cellValue).length === 13) {
            const date = new Date(cellValue); 
            if (!isNaN(date.getTime())) {
                return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
            }
        }
        // 处理数组 (多选/人员等)
        if (Array.isArray(cellValue)) {
            return cellValue.map(item => (typeof item === 'object' && item !== null) ? (item.text || item.name || '') : item).join(', ');
        }
        // 处理对象
        if (typeof cellValue === 'object') {
            return cellValue.text || '';
        }
        return String(cellValue);
    },
    chineseAmount: (n) => {
        n = safeFloat(n);
        if (n === 0) return '零元整'; 
        if (n > 999999999999.99) return '数值过大';
        
        let unit = "仟佰拾亿仟佰拾万仟佰拾元角分", str = ""; 
        n += "00"; 
        let p = n.indexOf('.'); 
        if (p >= 0) n = n.substring(0, p) + n.substr(p + 1, 2);
        
        unit = unit.substr(unit.length - n.length);
        for (let i = 0; i < n.length; i++) str += '零壹贰叁肆伍陆柒捌玖'.charAt(n.charAt(i)) + unit.charAt(i);
        return str.replace(/零(仟|佰|拾|角)/g, "零")
                  .replace(/(零)+/g, "零")
                  .replace(/零(万|亿|元)/g, "$1")
                  .replace(/(亿)万|壹(拾)/g, "$1$2")
                  .replace(/^元零?|零分/g, "")
                  .replace(/元$/g, "元整");
    },
    numberConfig: (value, config) => {
        let val = safeFloat(value);
        if (!config) return String(val); 
        
        let decimalPlaces = 0;
        let roundMode = 'round'; // 默认四舍五入

        // 解析格式配置
        if (config.match(/^\d+$/)) {
            decimalPlaces = parseInt(config, 10);
        } else if (config.match(/^(\d+)(入|舍)$/)) {
            const match = config.match(/^(\d+)(入|舍)$/);
            decimalPlaces = parseInt(match[1], 10);
            roundMode = match[2];
        }

        const multiplier = Math.pow(10, decimalPlaces);
        let result;

        switch (roundMode) {
            case '入': // 向上取整
                if (val < 0) result = Math.floor(val * multiplier) / multiplier;
                else result = Math.ceil(val * multiplier) / multiplier;
                break;
            case '舍': // 向下取整
                if (val < 0) result = Math.ceil(val * multiplier) / multiplier;
                else result = Math.floor(val * multiplier) / multiplier;
                break;
            default: // 四舍五入
                result = Math.round(val * multiplier) / multiplier;
        }
        return result.toFixed(decimalPlaces);
    }
};

// --- 数学几何工具 ---
export function getLineIntersection(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y) {
    const s1_x = p1_x - p0_x, s1_y = p1_y - p0_y;
    const s2_x = p3_x - p2_x, s2_y = p3_y - p2_y;
    const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = ( s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return { x: p0_x + (t * s1_x), y: p0_y + (t * s1_y) };
    return null;
}

// --- 数学表达式解析引擎 (调度场算法) ---
function shuntingYardEvaluate(expression) {
  const outputQueue = [];
  const operatorStack = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const associativity = { '+': 'L', '-': 'L', '*': 'L', '/': 'L' };

  const tokens = expression.match(/\d+\.?\d*|[+\-*/()]/g) || [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\d+\.?\d*$/.test(token)) {
      outputQueue.push(parseFloat(token));
    } else if (token === '(') {
      operatorStack.push(token);
    } else if (token === ')') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
        outputQueue.push(operatorStack.pop());
      }
      if (operatorStack.length === 0) throw new Error('括号不匹配');
      operatorStack.pop();
    } else if (token in precedence) {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1] !== '(' &&
        precedence[operatorStack[operatorStack.length - 1]] !== undefined &&
        (precedence[operatorStack[operatorStack.length - 1]] > precedence[token] ||
        (precedence[operatorStack[operatorStack.length - 1]] === precedence[token] && associativity[token] === 'L'))
      ) {
        outputQueue.push(operatorStack.pop());
      }
      operatorStack.push(token);
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop();
    if (op === '(' || op === ')') throw new Error('括号不匹配');
    outputQueue.push(op);
  }

  const stack = [];
  for (let i = 0; i < outputQueue.length; i++) {
    const token = outputQueue[i];
    if (typeof token === 'number') {
      stack.push(token);
    } else {
      if (stack.length < 2) throw new Error('表达式格式错误');
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': 
            if (b === 0) return 0; // 避免除零崩溃，返回0
            stack.push(a / b); 
            break;
        default: throw new Error(`未知运算符: ${token}`);
      }
    }
  }
  if (stack.length !== 1) return 0;
  return stack[0];
}

export function evaluateExpression(expression) {
  if (!expression || typeof expression !== 'string') return 0;
  
  // 移除所有空格
  expression = expression.replace(/\s+/g, '');
  
  // 验证表达式只包含数字、运算符、小数点和括号
  // 增加对空表达式的检查
  if (expression.length === 0) return 0;

  if (!/^[\d+\-*/().]+$/.test(expression)) {
    console.warn('表达式包含非法字符', expression);
    return 0;
  }
  try {
    const result = shuntingYardEvaluate(expression);
    return isNaN(result) ? 0 : result;
  } catch (error) {
    console.error('表达式计算错误:', error);
    return 0;
  }
}