import { markRaw, h } from 'vue';
import {
  Tickets, DCaret, Grid, Document, Picture, Cpu, Brush,
  VideoPause,  // For Vertical Text
  Crop,        // For Rectangle
  CircleCheck, // For Checkbox
  Calendar,    // For Date
  Switch,
  Minus,       // For Divider
  CollectionTag, // For Page Number
  EditPen      // For Signature
} from '@element-plus/icons-vue';

// 自定义圆形图标 - 优化为更大更清晰的圆环
const CircleIcon = {
  render: () => h('svg', { 
    viewBox: '0 0 1024 1024', 
    width: '1em', 
    height: '1em'
  }, [
    h('circle', { 
      cx: 512, 
      cy: 512, 
      r: 460, // 半径增大，使其在图标框中占比更大
      fill: 'none', 
      stroke: 'currentColor', 
      'stroke-width': 90 // 线条适当加粗
    })
  ])
};

export const LINE_STYLES = [
  { label: '实线', value: 'solid', dashArray: 'none' },
  { label: '虚线', value: 'dashed', dashArray: '5,5' },
  { label: '点线', value: 'dotted', dashArray: '2,2' },
  { label: '点划线', value: 'dash-dot', dashArray: '10,5,2,5' },
  { label: '双点划', value: 'dash-dot-dot', dashArray: '15,3,3,3,3,3' },
  { label: '长虚线', value: 'long-dash', dashArray: '20, 5' },
  { label: '稀疏点', value: 'sparse-dot', dashArray: '2, 8' }
];

export const BORDER_STYLES = [
  { label: '无边框', value: 'none' },
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
];

export const COMPONENT_TYPES = {
  TITLE: 'title', TEXT_ROW: 'text_row', RICH_TEXT: 'rich_text', V_TEXT: 'v_text',
  TABLE: 'table', IMAGE: 'image', QR_CODE: 'qr_code',
  DRAW_LINE: 'draw_line', DRAW_PATH: 'draw_path', TOOL_PEN: 'tool_pen',
  SHAPE_RECT: 'shape_rect', SHAPE_CIRCLE: 'shape_circle',
  CHECKBOX: 'checkbox', DATETIME: 'datetime',
  // [新增组件类型]
  DIVIDER: 'divider', PAGE_NUMBER: 'page_number', SIGNATURE: 'signature'
};

export const COMPONENT_GROUPS = [
  { title: '文本内容', items: [COMPONENT_TYPES.TITLE, COMPONENT_TYPES.TEXT_ROW, COMPONENT_TYPES.V_TEXT, COMPONENT_TYPES.RICH_TEXT, COMPONENT_TYPES.DATETIME, COMPONENT_TYPES.PAGE_NUMBER, COMPONENT_TYPES.SIGNATURE] },
  { title: '数据表格', items: [COMPONENT_TYPES.TABLE] },
  { title: '图形与控件', items: [COMPONENT_TYPES.DIVIDER, COMPONENT_TYPES.CHECKBOX, COMPONENT_TYPES.SHAPE_RECT, COMPONENT_TYPES.SHAPE_CIRCLE, COMPONENT_TYPES.TOOL_PEN] },
  { title: '媒体', items: [COMPONENT_TYPES.IMAGE, COMPONENT_TYPES.QR_CODE] }
];

const commonTextStyle = { 
    fontSize: 14, fontWeight: 'normal', textAlign: 'left', color: '#000000', lineHeight: 1.4, 
    zIndex: 2, whiteSpace: 'pre-wrap', 
    backgroundColor: 'transparent', borderWidth: 0, borderColor: '#000000', borderStyle: 'none', borderRadius: 0, padding: 0 
};

export const COMPONENT_TEMPLATES = {
  [COMPONENT_TYPES.TITLE]: { name: '大标题', icon: markRaw(Tickets), type: COMPONENT_TYPES.TITLE, content: '销售出库单', x: 0, y: 0, w: 794, h: 60, style: { ...commonTextStyle, fontSize: 24, fontWeight: 'bold', textAlign: 'center', zIndex: 1 } },
  [COMPONENT_TYPES.TEXT_ROW]: { name: '横向文本', icon: markRaw(DCaret), type: COMPONENT_TYPES.TEXT_ROW, content: '客户：{{客户名称}}', x: 40, y: 100, w: 300, h: 30, style: { ...commonTextStyle } },
  [COMPONENT_TYPES.V_TEXT]: { name: '竖向文本', icon: markRaw(VideoPause), type: COMPONENT_TYPES.V_TEXT, content: '竖排文本', x: 740, y: 100, w: 40, h: 200, style: { ...commonTextStyle, textAlign: 'center', letterSpacing: 2 } },
  [COMPONENT_TYPES.DATETIME]: { name: '日期时间', icon: markRaw(Calendar), type: COMPONENT_TYPES.DATETIME, content: '', format: 'YYYY-MM-DD', autoCurrent: true, x: 550, y: 60, w: 200, h: 30, style: { ...commonTextStyle, textAlign: 'right' } },
  
  // [修正] 页码默认格式，包含变量
  [COMPONENT_TYPES.PAGE_NUMBER]: { name: '页码', icon: markRaw(CollectionTag), type: COMPONENT_TYPES.PAGE_NUMBER, format: '第 {{page}} 页 / 共 {{total}} 页', x: 0, y: 1080, w: 794, h: 20, style: { ...commonTextStyle, fontSize: 12, textAlign: 'center' } },
  
  // [新增] 签名区
  [COMPONENT_TYPES.SIGNATURE]: { name: '签名区', icon: markRaw(EditPen), type: COMPONENT_TYPES.SIGNATURE, label: '客户签字：', showDate: true, x: 40, y: 900, w: 300, h: 40, style: { ...commonTextStyle, fontSize: 14 } },

  [COMPONENT_TYPES.TABLE]: { name: '明细表', icon: markRaw(Grid), type: COMPONENT_TYPES.TABLE, selectedFieldIds: [], columnWidths: '', emptyRows: 0, rowHeight: 36, dataAlign: 'left', dataVerticalAlign: 'middle', dataFontSize: 12, showSummary: true, summaryConfig: { left: '合计：', center: '', right: '@{{金额}}@' }, x: 40, y: 150, w: 714, h: 200, style: { fontSize: 13, zIndex: 0 } },
  [COMPONENT_TYPES.RICH_TEXT]: { name: '富文本', icon: markRaw(Document), type: COMPONENT_TYPES.RICH_TEXT, content: '备注：\n1. 请核对数量。\n2. 保修凭证。', x: 40, y: 400, w: 714, h: 80, style: { ...commonTextStyle, fontSize: 12 } },
  
  [COMPONENT_TYPES.SHAPE_RECT]: { name: '矩形', icon: markRaw(Crop), type: COMPONENT_TYPES.SHAPE_RECT, x: 40, y: 40, w: 100, h: 100, style: { strokeWidth: 1, strokeColor: '#000000', strokeStyle: 'solid', fillColor: 'transparent', borderRadius: 0, zIndex: 0 } },
  [COMPONENT_TYPES.SHAPE_CIRCLE]: { name: '圆形', icon: markRaw(CircleIcon), type: COMPONENT_TYPES.SHAPE_CIRCLE, x: 160, y: 40, w: 100, h: 100, style: { strokeWidth: 1, strokeColor: '#000000', strokeStyle: 'solid', fillColor: 'transparent', zIndex: 0 } },
  
  // [新增] 分割线
  [COMPONENT_TYPES.DIVIDER]: { name: '分割线', icon: markRaw(Minus), type: COMPONENT_TYPES.DIVIDER, orientation: 'h', x: 40, y: 140, w: 714, h: 10, style: { strokeWidth: 1, strokeColor: '#000000', strokeStyle: 'solid', zIndex: 0 } },

  [COMPONENT_TYPES.CHECKBOX]: { name: '勾选框', icon: markRaw(CircleCheck), type: COMPONENT_TYPES.CHECKBOX, content: '已审核', checked: false, x: 40, y: 500, w: 100, h: 30, style: { ...commonTextStyle, fontSize: 12 } },
  
  [COMPONENT_TYPES.IMAGE]: { name: '图片', icon: markRaw(Picture), type: COMPONENT_TYPES.IMAGE, src: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bitable_logo.png', x: 40, y: 20, w: 100, h: 40, style: { objectFit: 'contain', zIndex: 1 } },
  [COMPONENT_TYPES.QR_CODE]: { name: '二维码', icon: markRaw(Cpu), type: COMPONENT_TYPES.QR_CODE, content: '{{单号}}', x: 680, y: 20, w: 80, h: 80, style: { zIndex: 1 } },
  
  [COMPONENT_TYPES.TOOL_PEN]: { name: '画笔工具', icon: markRaw(Brush), type: COMPONENT_TYPES.TOOL_PEN }
};

export const getComponentName = (type) => COMPONENT_TEMPLATES[type]?.name || '组件';