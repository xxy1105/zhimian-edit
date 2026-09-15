import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, Col, Dropdown, Form, Input, InputNumber, message, Modal,
  Progress, Row, Segmented, Select, Space, Table, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined, BarsOutlined, CloudDownloadOutlined, CloudUploadOutlined,
  ColumnHeightOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import type { CollectionName } from '../services/api';
import { DetailDrawer, ImportWizard, PageHeader, StatCard, StatusTag } from './Common';

export type RecordType = Record<string, unknown> & { key:string };

export type BusinessListProps = {
  title:string; description:string; stats:{label:string;value:string|number;tone?:string}[];
  data:RecordType[]; columns:ColumnsType<RecordType>; primaryAction?:string; allowBoard?:boolean;
  collection:CollectionName;
  filterNames?:string[]; filterOptions?:Record<string, {value:string;label:string}[]>; headerExtra?:ReactNode;
  rowActions?:(record:RecordType)=>ReactNode;
};

export function BusinessList({
  title, description, stats, data, columns, collection, primaryAction='新建', allowBoard=true,
  filterNames=['关键词','项目','岗位','负责人','状态'], filterOptions={}, headerExtra, rowActions,
}: BusinessListProps) {
  const location=useLocation();
  const navigate=useNavigate();
  const { canEdit, canDelete } = useApp();
  const {
    projects, jobs, loading, refresh, createRecord, updateRecord, deleteRecord, downloadRecords,
  } = useData();
  const [localData, setLocalData] = useState<RecordType[]>(data);
  const [keyword, setKeyword] = useState('');
  const [view, setView] = useState<string>('表格');
  const [active, setActive] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string,string>>({});
  const [drawer, setDrawer] = useState<RecordType>();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRecord, setEditorRecord] = useState<RecordType>();
  const [saving, setSaving] = useState(false);
  const [tableSize, setTableSize] = useState<'small'|'middle'>('middle');
  const [form] = Form.useForm();
  useEffect(()=>{
    setLocalData(data);
  },[data]);
  const filtered = useMemo(() => localData.filter(item =>
    (!keyword || JSON.stringify(item).toLowerCase().includes(keyword.toLowerCase())) &&
    (!active || JSON.stringify(item).includes(active)) &&
    Object.values(filterValues).every(value=>!value || JSON.stringify(item).includes(value))
  ), [localData, keyword, active, filterValues]);

  const deleteRecords = (keys:React.Key[]) => {
    const affected = localData.filter(item=>keys.includes(item.key));
    Modal.confirm({
      title:`确认删除 ${affected.length} 条${title.replace('管理','')}数据？`,
      icon:<DeleteOutlined style={{color:'#d9363e'}} />,
      content:<div><p>删除后数据将从服务端数据文件中移除，且无法撤销。</p><p className="danger-text">影响对象：{affected.slice(0,3).map(item=>String(item.name || item.candidate || item.code)).join('、')}{affected.length>3?' 等':''}</p></div>,
      okText:'确认删除',
      cancelText:'取消',
      okButtonProps:{danger:true},
      onOk:async()=>{
        await Promise.all(keys.map((key)=>deleteRecord(collection,String(key))));
        setSelectedKeys([]);
        message.success(`已删除 ${affected.length} 条数据`);
      },
    });
  };

  const openEditor = (record?:RecordType) => {
    setEditorRecord(record);
    form.resetFields();
    if (record) form.setFieldsValue(record);
    setEditorOpen(true);
  };

  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    if(params.get('create')==='1'){
      openEditor();
      navigate(location.pathname,{replace:true});
    }
    const status=params.get('status');
    if(status)setActive(status);
  },[location.pathname,location.search,navigate]);

  const saveEditor = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editorRecord) {
        await updateRecord(collection, editorRecord.key, values);
        message.success('数据已更新');
      } else {
        await createRecord(collection, values);
        message.success('数据已创建');
      }
      setEditorOpen(false);
      form.resetFields();
    } finally {
      setSaving(false);
    }
  };

  const editorFields = getEditorFields(collection);
  const boardItems = (bucket:string) => filtered.filter((item)=>{
    const status=String(item.status || '');
    if(bucket==='进行中') return /进行中|招聘中|面试中|启用|已发送/.test(status);
    if(bucket==='待处理') return /待|审批|草稿|异常/.test(status);
    if(bucket==='已完成') return /完成|通过|发布/.test(status) && !status.includes('归档');
    return /归档|结束|关闭|停用/.test(status);
  });

  const getFilterOptions = (name:string) => {
    if (filterOptions[name]) return filterOptions[name];
    if (name.includes('项目')) return projects.map(item=>({value:String(item.name),label:String(item.name)}));
    if (name.includes('岗位')) return jobs.map(item=>({value:String(item.name),label:String(item.name)}));
    if (name.includes('招聘专员') || name.includes('负责人')) return ['许昭','唐宁','苏晚','温言','周谨言'].map(value=>({value,label:value}));
    if (name.includes('轮次')) return ['首轮 AI 面试','二轮人工复试','终试','客户面'].map(value=>({value,label:value}));
    if (name.includes('链接')) return ['待发送','已发送','已访问','进行中','已完成','已过期','发送失败'].map(value=>({value,label:value}));
    return ['待面试','面试中','待评分','待审核','待安排下一轮','待客户面','最终通过','异常'].map(value=>({value,label:value}));
  };

  const enhancedColumns: ColumnsType<RecordType> = [
    ...columns,
    {
      title:'操作', key:'action', fixed:'right', width:150,
      render:(_, record) => <Space size={2}>
        {rowActions?.(record)}
        <Button type="link" size="small" onClick={()=>setDrawer(record)}>查看</Button>
        <Tooltip title={canEdit ? '' : '当前角色为只读权限'}>
        <Button type="link" size="small" disabled={!canEdit} onClick={()=>openEditor(record)}>编辑</Button>
        </Tooltip>
        <Dropdown menu={{items:[
          {key:'copy',label:'复制'},
          {key:'log',label:'操作日志'},
          {key:'archive',label:'归档'},
          ...(canDelete ? [{type:'divider' as const},{key:'delete',label:'删除',danger:true,icon:<DeleteOutlined />}] : []),
        ],onClick:async({key})=>{
          if(key==='delete') return deleteRecords([record.key]);
          if(key==='archive'){
            await updateRecord(collection,record.key,{status:'已归档'});
            message.success('数据已归档');
            return;
          }
          if(key==='copy'){
            const {key:_,...copy}=record;
            await createRecord(collection,{...copy,name:`${String(record.name||record.candidate||record.code)}（副本）`});
            message.success('副本已创建');
            return;
          }
          message.info('操作日志已记录');
        }}}>
          <Button type="link" size="small">更多</Button>
        </Dropdown>
      </Space>
    },
  ];

  return (
    <div>
      <PageHeader title={title} description={description} extra={<>
        {headerExtra}
        <Tooltip title={canEdit ? '' : '数据观察员仅有查看权限'}>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canEdit} onClick={()=>openEditor()}>{primaryAction}</Button>
        </Tooltip>
      </>} />
      <Row gutter={12} className="stats-row">
        {stats.map(item=><Col flex="1" key={item.label}><StatCard {...item} active={active===item.label} onClick={()=>setActive(active===item.label?'':item.label.replace('全部',''))} /></Col>)}
      </Row>
      <Card className="filter-panel">
        <div className="filter-grid">
          {filterNames.map((name,index)=>index===0 ?
            <Input.Search key={name} allowClear placeholder={`搜索${name}`} value={keyword} onChange={e=>setKeyword(e.target.value)} /> :
            <Select key={name} allowClear showSearch optionFilterProp="label" placeholder={name} value={filterValues[name]} onChange={value=>setFilterValues(current=>({...current,[name]:value}))} options={getFilterOptions(name)} />)}
          <Space><Button type="primary" onClick={()=>message.success(`筛选条件已应用，共 ${filtered.length} 条`)}>查询</Button><Button onClick={()=>{setKeyword('');setActive('');setFilterValues({});}}>重置</Button></Space>
        </div>
      </Card>
      <Card className="table-panel">
        <div className="table-toolbar">
          <Space>
            {allowBoard && <Segmented value={view} onChange={setView} options={[{label:'表格',value:'表格',icon:<BarsOutlined />},{label:'看板',value:'看板',icon:<AppstoreOutlined />}]} />}
            {selectedKeys.length > 0 && <Badge count={selectedKeys.length} color="#1677ff"><Button>已选数据</Button></Badge>}
            {canDelete && selectedKeys.length > 0 && <Button danger icon={<DeleteOutlined />} onClick={()=>deleteRecords(selectedKeys)}>批量删除</Button>}
          </Space>
          <Space>
            <Button icon={<CloudUploadOutlined />} onClick={()=>setImportOpen(true)}>导入</Button>
            <Button icon={<CloudDownloadOutlined />} onClick={async()=>{await downloadRecords(collection);message.success('CSV 已导出');}}>导出</Button>
            <Tooltip title={tableSize==='small'?'标准密度':'紧凑密度'}><Button icon={<ColumnHeightOutlined />} onClick={()=>setTableSize(current=>current==='small'?'middle':'small')} /></Tooltip>
            <Tooltip title="刷新"><Button loading={loading} icon={<ReloadOutlined />} onClick={()=>void refresh()} /></Tooltip>
          </Space>
        </div>
        {view === '表格' ? <Table
          rowSelection={{selectedRowKeys:selectedKeys,onChange:setSelectedKeys}}
          dataSource={filtered} columns={enhancedColumns} scroll={{x:1300}}
          loading={loading} size={tableSize}
          pagination={{pageSize:8,showSizeChanger:true,showTotal:t=>`共 ${t} 条`}}
        /> : <div className="board-grid">{['进行中','待处理','已完成','已归档'].map(status=>
          <div className="board-column" key={status}><h3>{status}<Badge count={boardItems(status).length} showZero /></h3>
            {boardItems(status).slice(0,6).map(item=><Card key={`${status}-${item.key}`} size="small" hoverable onClick={()=>setDrawer(item)}>
              <b>{String(item.name || item.candidate || item.title)}</b><p>{String(item.code || item.project || '')}</p>
              {item.progress !== undefined && <Progress size="small" percent={Number(item.progress)} />}
              <div className="board-card-footer"><StatusTag status={String(item.status || status)} />{canDelete&&<Button danger type="link" size="small" icon={<DeleteOutlined />} onClick={event=>{event.stopPropagation();deleteRecords([item.key]);}}>删除</Button>}</div>
            </Card>)}
          </div>)}</div>}
      </Card>
      <DetailDrawer open={!!drawer} onClose={()=>setDrawer(undefined)} title={`${title}详情`} record={drawer} />
      <ImportWizard open={importOpen} onClose={()=>setImportOpen(false)} onImport={async(rows)=>{
        await Promise.all(rows.map(row=>createRecord(collection,row)));
      }} />
      <Modal open={editorOpen} onCancel={()=>setEditorOpen(false)} onOk={saveEditor} confirmLoading={saving} title={editorRecord?`编辑${title.replace('管理','')}`:primaryAction} okText="保存">
        <Form form={form} layout="vertical" preserve={false}>
          {editorFields.map((field)=><Form.Item key={field.name} name={field.name} label={field.label} rules={field.required?[{required:true,message:`请填写${field.label}`}]:undefined}>
            {field.type==='number'?<InputNumber min={0} style={{width:'100%'}} />:
              field.type==='project'?<Select showSearch options={projects.map(item=>({value:String(item.name),label:String(item.name)}))} />:
              field.type==='job'?<Select showSearch options={jobs.map(item=>({value:String(item.name),label:String(item.name)}))} />:
              field.type==='status'?<Select options={['草稿','进行中','招聘中','待审批','启用','停用','已完成','已归档'].map(value=>({value,label:value}))} />:
              <Input />}
          </Form.Item>)}
        </Form>
      </Modal>
    </div>
  );
}

type EditorField = {
  name:string;
  label:string;
  type?:'number'|'project'|'job'|'status';
  required?:boolean;
};

function getEditorFields(collection:CollectionName):EditorField[] {
  const common:EditorField[]=[
    {name:'name',label:'名称',required:true},
    {name:'owner',label:'负责人'},
    {name:'status',label:'状态',type:'status',required:true},
  ];
  const fields:Partial<Record<CollectionName,EditorField[]>>={
    projects:[
      {name:'name',label:'项目名称',required:true},{name:'client',label:'客户 / 业务线',required:true},
      {name:'manager',label:'项目经理',required:true},{name:'target',label:'目标人数',type:'number'},
      {name:'status',label:'状态',type:'status',required:true},
    ],
    jobs:[
      {name:'name',label:'岗位名称',required:true},{name:'project',label:'所属项目',type:'project',required:true},
      {name:'owner',label:'岗位负责人',required:true},{name:'recruiter',label:'招聘专员'},
      {name:'hc',label:'HC',type:'number'},{name:'city',label:'工作地点'},
      {name:'status',label:'状态',type:'status',required:true},
    ],
    candidates:[
      {name:'name',label:'候选人姓名',required:true},{name:'contact',label:'手机号',required:true},
      {name:'email',label:'邮箱'},{name:'project',label:'目标项目',type:'project'},
      {name:'job',label:'目标岗位',type:'job'},{name:'owner',label:'负责人'},
      {name:'status',label:'状态',type:'status',required:true},
    ],
    questions:[
      {name:'name',label:'题目内容',required:true},{name:'project',label:'所属项目',type:'project'},
      {name:'job',label:'适用岗位',type:'job'},{name:'type',label:'题型'},
      {name:'difficulty',label:'难度'},{name:'status',label:'状态',type:'status',required:true},
    ],
    scoreTemplates:[
      {name:'name',label:'模板名称',required:true},{name:'project',label:'所属项目',type:'project'},
      {name:'job',label:'适用岗位',type:'job'},{name:'line',label:'通过线',type:'number'},
      {name:'status',label:'状态',type:'status',required:true},
    ],
    users:[
      {name:'name',label:'姓名',required:true},{name:'account',label:'账号',required:true},
      {name:'department',label:'部门'},{name:'role',label:'角色'},
      {name:'status',label:'状态',type:'status',required:true},
    ],
  };
  return fields[collection] || common;
}

export const textCol = (title:string, dataIndex:string, width=140) => ({ title, dataIndex, width, ellipsis:true });
export const statusCol = (title='状态', dataIndex='status', width=110) => ({
  title, dataIndex, width, render:(value:string)=><StatusTag status={value} />,
});
export const progressCol = (title='完成率', dataIndex='progress', width=150) => ({
  title, dataIndex, width, sorter:(a:RecordType,b:RecordType)=>Number(a[dataIndex])-Number(b[dataIndex]),
  render:(value:number)=><Progress percent={value} size="small" strokeColor={value<50?'#fa8c16':'#1677ff'} />,
});
