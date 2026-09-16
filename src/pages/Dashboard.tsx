import { useState } from 'react';
import { Area, Column, Funnel } from '@ant-design/charts';
import { Button, Card, Checkbox, Col, DatePicker, List, Progress, Row, Select, Space, Tag, Tooltip } from 'antd';
import {
  ArrowRightOutlined, PlusOutlined, RocketOutlined,
  SyncOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '../components/Common';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import type { RecordType } from '../components/BusinessList';

export function Dashboard() {
  const navigate = useNavigate();
  const { dataScope,user } = useApp();
  const {projects:projectRecords,jobs,interviews}=useData();
  const projects=projectRecords as Array<RecordType&{name:string;status:string;progress:number;passed:number;target:number;risk:string}>;
  const [project, setProject] = useState('all');
  const [trendTypes, setTrendTypes] = useState<string[]>(['邀约量','完成量']);
  const trendMap=new Map<string,{date:string;邀约量:number;完成量:number}>();
  interviews.forEach(item=>{const date=String(item.updated||'未知').slice(0,5);const value=trendMap.get(date)||{date,邀约量:0,完成量:0};value.邀约量++;if(/完成|审核|通过/.test(String(item.status)))value.完成量++;trendMap.set(date,value);});
  const trendSeries = [...trendMap.values()].flatMap(x=>[
    {date:x.date,type:'邀约量',value:x.邀约量},
    {date:x.date,type:'完成量',value:x.完成量},
  ]).filter(item=>trendTypes.includes(item.type));
  const funnelData=[{stage:'已邀约',value:interviews.length},{stage:'已访问',value:interviews.filter(item=>!['已发送','待发送'].includes(String(item.linkStatus))).length},{stage:'已完成',value:interviews.filter(item=>/完成|审核|通过/.test(String(item.status))).length},{stage:'通过',value:interviews.filter(item=>/通过|下一轮/.test(String(item.status))).length}];
  const risks=[...new Set(interviews.map(item=>String(item.risk||'')).filter(Boolean))].map(risk=>[risk,interviews.filter(item=>item.risk===risk).length,'来自面试记录'] as const);
  const openTrendDetail = (event?: { data?: { data?: { date?:string; type?:string } } }) => {
    const datum = event?.data?.data;
    const params = new URLSearchParams({
      source:'首页工作台',
      metric:datum?.type || trendTypes.join('、') || '面试趋势',
      date:datum?.date || '近14天',
      project,
    });
    navigate(`/analytics/detail?${params.toString()}`);
  };
  return <div>
    <div className="welcome-bar">
      <div><span>{new Intl.DateTimeFormat('zh-CN',{dateStyle:'full'}).format(new Date())}</span><h1>你好，{user?.name}</h1><p>当前数据范围：{dataScope}</p></div>
      <Space><Button icon={<RocketOutlined />} type="primary" onClick={()=>navigate('/interviews/invite')}>发起邀约</Button><Button icon={<PlusOutlined />} onClick={()=>navigate('/jobs')}>新建岗位</Button><Button icon={<ArrowRightOutlined />} onClick={()=>navigate('/analytics/overview')}>查看数据看板</Button></Space>
    </div>
    <div className="dashboard-filter">
      <Space><DatePicker.RangePicker /><Select value={project} onChange={setProject} style={{width:240}} options={[{value:'all',label:'全部项目'},...projects.map(x=>({value:x.key,label:x.name}))]} /><Select placeholder="全部岗位" style={{width:180}} options={[{value:'all',label:'全部岗位'},...jobs.map(item=>({value:item.key,label:String(item.name)}))]} /></Space>
      <span><SyncOutlined /> 数据已实时同步</span>
    </div>
    <Row gutter={12} className="stats-row five">
      <Col flex="1"><StatCard label="累计面试人数" value={interviews.length} onClick={()=>navigate('/records')} /></Col>
      <Col flex="1"><StatCard label="进行中项目" value={projects.filter(item=>item.status==='进行中').length} tone="cyan" onClick={()=>navigate('/projects?status=进行中')} /></Col>
      <Col flex="1"><StatCard label="招聘中岗位" value={jobs.filter(item=>item.status==='招聘中').length} tone="green" onClick={()=>navigate('/jobs?status=招聘中')} /></Col>
      <Col flex="1"><StatCard label="AI 面试完成量" value={interviews.filter(item=>/完成|审核|通过/.test(String(item.status))).length} tone="violet" onClick={()=>navigate('/records?type=AI')} /></Col>
      <Col flex="1"><StatCard label="本月节省人工时长" value={`${Math.round(interviews.length*0.6)}h`} tone="orange" onClick={()=>navigate('/analytics/interviews')} /></Col>
    </Row>
    <Card className="overview-strip" title="今日运行概览">
      <div className="overview-items">
        {[['今日待面试',interviews.filter(item=>item.status==='待面试').length,'blue'],['面试中',interviews.filter(item=>item.status==='面试中').length,'cyan'],['待审核',interviews.filter(item=>item.status==='待审核').length,'orange'],['异常数量',interviews.filter(item=>item.risk).length,'red'],['24 小时内过期',interviews.filter(item=>String(item.risk).includes('过期')).length,'gold']].map(x=><div key={x[0]} onClick={()=>navigate('/interviews/process')}><span className={`dot ${x[2]}`} /><b>{x[1]}</b><small>{x[0]}</small></div>)}
      </div>
    </Card>
    <Row gutter={16}>
      <Col span={15}><Card title="招聘转化漏斗" extra={<Tooltip title="点击查看明细"><Button type="link" onClick={()=>navigate('/analytics/detail?source=dashboard&metric=funnel')}>查看明细</Button></Tooltip>} className="chart-card">
        <Funnel data={funnelData} xField="stage" yField="value" shape="funnel" colorField="stage" style={{fillOpacity:0.88}} onReady={chart=>chart.on('element:click',()=>navigate('/analytics/detail?source=dashboard&metric=funnel'))} />
      </Card></Col>
      <Col span={9}><Card title="项目进度排行" extra={<Button type="link" onClick={()=>navigate('/projects')}>全部项目</Button>} className="chart-card">
        <List dataSource={projects.slice(0,4)} renderItem={(item,index)=><List.Item className="rank-item" onClick={()=>navigate(`/projects/${item.key}`)}>
          <span className={`rank ${index<3?'top':''}`}>{index+1}</span><div className="rank-main"><b>{item.name}</b><div><Progress percent={item.progress} size="small" showInfo={false} /><span>{item.passed}/{item.target}</span></div></div><Tag color={item.risk==='正常'?'green':'orange'}>{item.risk}</Tag>
        </List.Item>} />
      </Card></Col>
    </Row>
    <Row gutter={16}>
      <Col span={16}><Card title="近 14 天面试趋势" extra={<Space><Checkbox.Group className="trend-selector" value={trendTypes} onChange={values=>setTrendTypes(values as string[])} options={['邀约量','完成量']} /><Button type="link" onClick={()=>openTrendDetail()}>查看明细</Button></Space>} className="chart-card clickable-chart">
        <Area data={trendSeries} xField="date" yField="value" colorField="type" shapeField="smooth" point={{shapeField:'circle',sizeField:4}} style={{fillOpacity:0.12,cursor:'pointer'}} axis={{y:{title:'人数'}}} onReady={chart=>chart.on('element:click',openTrendDetail)} />
      </Card></Col>
      <Col span={8}><Card title="异常预警" extra={<Button type="link" onClick={()=>navigate('/interviews/exceptions')}>全部异常</Button>} className="chart-card">
        <List locale={{emptyText:'当前没有异常'}} dataSource={risks} renderItem={item=><List.Item className="warning-item" onClick={()=>navigate('/interviews/exceptions')}><WarningOutlined /><div><b>{item[0]} <Tag color="red">{item[1]}</Tag></b><span>{item[2]}</span></div><ArrowRightOutlined /></List.Item>} />
      </Card></Col>
    </Row>
  </div>;
}
