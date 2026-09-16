import { useState, type ReactNode } from 'react';
import { Alert, Button, Card, Form, Input, Spin } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useData } from '../context/DataContext';

export function LoginGate({children}:{children:ReactNode}){
  const {authenticated,loading,error,login}=useData();
  const [submitting,setSubmitting]=useState(false);
  const [loginError,setLoginError]=useState<string>();
  if(loading)return <div className="login-shell"><Spin size="large"/></div>;
  if(authenticated)return children;
  const submit=async(values:{username:string;password:string})=>{
    setSubmitting(true);setLoginError(undefined);
    try{await login(values.username,values.password);}
    catch(reason){setLoginError(reason instanceof Error?reason.message:'登录失败');}
    finally{setSubmitting(false);}
  };
  return <div className="login-shell"><Card className="login-panel">
    <div className="login-brand"><div className="brand-mark">智</div><div><h1>智面 ATS</h1><p>招聘与智能面试管理控制台</p></div></div>
    {(loginError||error)&&<Alert type="error" showIcon message={loginError||error}/>}
    <Form layout="vertical" onFinish={submit} initialValues={{username:'admin'}}>
      <Form.Item name="username" label="账号" rules={[{required:true}]}><Input prefix={<UserOutlined/>} autoComplete="username"/></Form.Item>
      <Form.Item name="password" label="密码" rules={[{required:true}]}><Input.Password prefix={<LockOutlined/>} autoComplete="current-password"/></Form.Item>
      <Button block type="primary" htmlType="submit" loading={submitting}>登录</Button>
    </Form>
    <p className="login-hint">本地开发默认密码由 ADMIN_PASSWORD 环境变量配置。</p>
  </Card></div>;
}

