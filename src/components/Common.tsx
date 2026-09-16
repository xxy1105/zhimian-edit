import { useState, type ReactNode } from 'react';
import { readSheet } from 'read-excel-file/browser';
import {
  Alert, Button, Card, Descriptions, Divider, Drawer,
  message, Modal, Progress, Result, Space, Steps, Table,
  Tag, Timeline, Tooltip, Upload,
} from 'antd';
import {
  CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, DownloadOutlined,
  FileExcelOutlined, InboxOutlined, InfoCircleOutlined,
} from '@ant-design/icons';

const colorMap: Record<string, string> = {
  '进行中':'processing','招聘中':'processing','面试中':'processing','已访问':'processing',
  '已发送':'blue','待面试':'blue','待评分':'orange','待审核':'orange','审批中':'orange',
  '异常':'error','发送失败':'error','评分异常':'error','已驳回':'error','紧急':'error',
  '通过':'success','已通过':'success','已完成':'success','启用':'success','最终通过':'success',
  '已归档':'default','已过期':'default','已废弃':'default','暂停':'default','草稿':'default',
};

export function StatusTag({ status }: { status: string }) {
  const color = colorMap[status] || (status.includes('失败') ? 'error' : status.includes('待') ? 'warning' : 'default');
  const icon = color === 'error' ? <CloseCircleFilled /> : color === 'success' ? <CheckCircleFilled /> :
    color === 'processing' ? <ClockCircleFilled /> : undefined;
  return <Tag color={color} icon={icon}>{status}</Tag>;
}

export function StatCard({ label, value, trend, active, onClick, tone = 'blue' }: {
  label:string; value:string|number; trend?:string; active?:boolean; onClick?:()=>void; tone?:string;
}) {
  return (
    <Card className={`stat-card ${active ? 'active' : ''}`} onClick={onClick} hoverable={!!onClick}>
      <div className={`stat-accent ${tone}`} />
      <div className="stat-label">{label}<Tooltip title="示例口径，数据每 5 分钟更新"><InfoCircleOutlined /></Tooltip></div>
      <div className="stat-value">{value}</div>
      {trend && <div className={trend.startsWith('+') ? 'trend up' : 'trend'}>{trend} <span>较上月</span></div>}
    </Card>
  );
}

export function PageHeader({ title, description, extra }: { title:string; description:string; extra?:ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><Space>{extra}</Space></div>;
}

export function DetailDrawer({ open, onClose, title, record }: {
  open:boolean; onClose:()=>void; title:string; record?:Record<string, unknown>;
}) {
  return (
    <Drawer open={open} onClose={onClose} width={620} title={title}>
      <Alert type="info" showIcon message="信息来自智面 ATS API" />
      <Descriptions column={1} bordered size="small" style={{ marginTop:16 }}>
        {Object.entries(record || {}).filter(([k]) => k !== 'key').slice(0, 10).map(([k,v]) =>
          <Descriptions.Item key={k} label={k}>{String(v)}</Descriptions.Item>)}
      </Descriptions>
      {Boolean(record?.updated)&&<><Divider titlePlacement="start">更新时间</Divider><Timeline items={[{color:'blue',children:String(record?.updated)}]}/></>}
    </Drawer>
  );
}

const importFieldMap:Record<string,string>={
  '名称':'name','项目名称':'name','岗位名称':'name','候选人姓名':'name','姓名':'name',
  '手机号':'contact','联系电话':'contact','邮箱':'email','客户':'client','客户 / 业务线':'client',
  '负责人':'owner','项目经理':'manager','所属项目':'project','目标项目':'project',
  '所属岗位':'job','目标岗位':'job','应聘职位':'job','状态':'status','目标人数':'target','HC':'hc',
};

export function ImportWizard({ open, onClose, onImport }: {
  open:boolean;
  onClose:()=>void;
  onImport?:(rows:Record<string,unknown>[])=>Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [rows,setRows]=useState<Record<string,unknown>[]>([]);
  const [headers,setHeaders]=useState<string[]>([]);
  const [fileName,setFileName]=useState('');
  const [importing,setImporting]=useState(false);
  const close=()=>{setStep(0);setRows([]);setHeaders([]);setFileName('');onClose();};
  const parseFile=async(file:File)=>{
    const matrix=await readSheet(file);
    const sourceHeaders=(matrix[0]||[]).map(value=>String(value||'').trim()).filter(Boolean);
    const parsed=matrix.slice(1).filter(row=>row.some(Boolean)).map((row,index)=>Object.fromEntries(sourceHeaders.map((header,column)=>[
      importFieldMap[header]||header,
      row[column]??'',
    ]).concat([['importRow',index+2]])));
    setHeaders(sourceHeaders);
    setRows(parsed);
    setFileName(file.name);
    setStep(1);
  };
  const finish=async()=>{
    if(!rows.length)return;
    setImporting(true);
    try{
      await onImport?.(rows.map(({importRow:_,...row})=>row));
      message.success(`导入完成：成功 ${rows.length} 条`);
      setStep(3);
    }finally{setImporting(false);}
  };
  const downloadTemplate=()=>{
    const content='\uFEFF名称,负责人,状态\n示例数据,周谨言,草稿\n';
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download='智面导入模板.csv';anchor.click();URL.revokeObjectURL(url);
  };
  return (
    <Modal open={open} onCancel={close} width={760} title="导入 Excel" footer={[
      <Button key="cancel" onClick={close}>取消</Button>,
      step > 0 && <Button key="back" onClick={()=>setStep(step-1)}>上一步</Button>,
      step < 3 && <Button key="next" type="primary" loading={importing} disabled={!rows.length} onClick={()=>step === 2 ? void finish() : setStep(step+1)}>{step===2?'开始导入':'下一步'}</Button>,
      step === 3 && <Button key="done" type="primary" onClick={close}>查看数据</Button>,
    ]}>
      <Steps current={step} size="small" items={['上传文件','字段映射','数据预览','导入结果'].map(title=>({title}))} />
      <div className="wizard-content">
        {step === 0 && <><Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载导入模板</Button><Upload.Dragger accept=".xlsx" maxCount={1} beforeUpload={file=>{void parseFile(file);return false;}} style={{marginTop:16}}><p className="ant-upload-drag-icon"><InboxOutlined /></p><p>拖拽 Excel 文件到此处，或点击上传</p><p className="hint">支持 .xlsx，首行为字段名，文件不超过 20MB</p></Upload.Dragger></>}
        {step === 1 && <><Alert message={`已读取 ${fileName}，识别 ${headers.length} 个字段、${rows.length} 条数据`} type="success" showIcon/>{headers.map(header=><div className="mapping-row" key={header}><b>{header}</b><span>→</span><Tag color="blue">{importFieldMap[header]||header}</Tag></div>)}</>}
        {step === 2 && <><Alert message={`共 ${rows.length} 条数据，确认后将写入 API`} type="info" showIcon/><Table size="small" pagination={{pageSize:5}} dataSource={rows.map((row,index)=>({...row,key:index}))} columns={headers.slice(0,5).map(header=>({title:header,dataIndex:importFieldMap[header]||header,ellipsis:true}))} /></>}
        {step === 3 && <Result status="success" title="导入成功" subTitle={`${rows.length} 条数据已持久化`} extra={<Button icon={<FileExcelOutlined />} onClick={close}>返回列表</Button>} />}
      </div>
    </Modal>
  );
}
