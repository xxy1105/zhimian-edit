import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { api, collectionNames, type ApiData, type ApiEntity, type CollectionName } from '../services/api';
import { useApp, type CurrentUser } from './AppContext';

const emptyData: ApiData = {
  ...Object.fromEntries(collectionNames.map((name) => [name, []])) as unknown as Record<CollectionName, ApiEntity[]>,
  settings: {},
};

type DataContextValue = ApiData & {
  loading:boolean;
  authenticated:boolean;
  error?:string;
  login:(username:string,password:string)=>Promise<void>;
  logout:()=>Promise<void>;
  refresh:()=>Promise<void>;
  createRecord:(collection:CollectionName,values:Record<string,unknown>)=>Promise<ApiEntity>;
  updateRecord:(collection:CollectionName,key:string,values:Record<string,unknown>)=>Promise<ApiEntity>;
  deleteRecord:(collection:CollectionName,key:string)=>Promise<void>;
  inviteCandidates:(values:Record<string,unknown>)=>Promise<ApiEntity[]>;
  reissueInterview:(key:string)=>Promise<ApiEntity>;
  controlInterview:(key:string,action:string,value?:number)=>Promise<ApiEntity>;
  syncInterviewResult:(key:string)=>Promise<ApiEntity>;
  reviewInterview:(key:string,values:Record<string,unknown>)=>Promise<ApiEntity>;
  completeInterview:(key:string,values:Record<string,unknown>)=>Promise<ApiEntity>;
  createMeeting:(values:Record<string,unknown>)=>Promise<ApiEntity>;
  syncMeeting:(key:string)=>Promise<ApiEntity>;
  downloadRecords:(collection:CollectionName)=>Promise<void>;
  updateSettings:(values:Record<string,unknown>)=>Promise<Record<string,unknown>>;
  testFeishu:()=>Promise<{connected:boolean;userName?:string;checkedAt:string}>;
  testNotifications:()=>Promise<Record<string,unknown>>;
  parseResume:(file:File)=>Promise<Record<string,unknown>>;
};

const DataContext=createContext<DataContextValue|null>(null);

export function DataProvider({children}:{children:ReactNode}){
  const {setUser}=useApp();
  const [data,setData]=useState<ApiData>(emptyData);
  const [loading,setLoading]=useState(true);
  const [authenticated,setAuthenticated]=useState(false);
  const [error,setError]=useState<string>();

  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const next=await api.bootstrap();
      setData(next);
      setUser(next.user as CurrentUser);
      setAuthenticated(true);
      setError(undefined);
    }catch(reason){
      setData(emptyData);
      setUser(undefined);
      setAuthenticated(false);
      setError(reason instanceof Error?reason.message:'数据加载失败');
    }finally{setLoading(false);}
  },[setUser]);

  useEffect(()=>{void refresh();},[refresh]);

  const replace=useCallback((collection:CollectionName,record:ApiEntity)=>{
    setData(current=>({...current,[collection]:current[collection].map(item=>item.key===record.key?record:item)}));
  },[]);

  const value=useMemo<DataContextValue>(()=>({
    ...data,loading,authenticated,error,refresh,
    login:async(username,password)=>{await api.login(username,password);await refresh();},
    logout:async()=>{await api.logout();setData(emptyData);setUser(undefined);setAuthenticated(false);},
    createRecord:async(collection,values)=>{
      const record=await api.create(collection,values);
      setData(current=>({...current,[collection]:[record,...current[collection]]}));
      return record;
    },
    updateRecord:async(collection,key,values)=>{
      const record=await api.update(collection,key,values);replace(collection,record);return record;
    },
    deleteRecord:async(collection,key)=>{
      await api.remove(collection,key);
      setData(current=>({...current,[collection]:current[collection].filter(item=>item.key!==key)}));
    },
    inviteCandidates:async(values)=>{
      const records=await api.invite(values);
      setData(current=>({...current,interviews:[...records,...current.interviews]}));
      return records;
    },
    reissueInterview:async(key)=>{
      const record=await api.reissue(key);
      setData(current=>({...current,interviews:[record,...current.interviews.map(item=>item.key===key?{...item,status:'已废弃',linkStatus:'已失效'}:item)]}));
      return record;
    },
    controlInterview:async(key,action,actionValue)=>{
      const record=await api.controlInterview(key,action,actionValue);replace('interviews',record);return record;
    },
    syncInterviewResult:async(key)=>{
      const record=await api.syncInterviewResult(key);replace('interviews',record);return record;
    },
    reviewInterview:async(key,values)=>{const record=await api.review(key,values);replace('interviews',record);return record;},
    completeInterview:async(key,values)=>{const record=await api.complete(key,values);replace('interviews',record);return record;},
    createMeeting:async(values)=>{
      const record=await api.createMeeting(values);
      setData(current=>({...current,interviews:[record,...current.interviews]}));
      return record;
    },
    syncMeeting:async(key)=>{const record=await api.syncMeeting(key);replace('interviews',record);return record;},
    downloadRecords:collection=>api.download(collection),
    updateSettings:async(values)=>{
      const settings=await api.updateSettings(values);setData(current=>({...current,settings}));return settings;
    },
    testFeishu:()=>api.testFeishu(),
    testNotifications:()=>api.testNotifications(),
    parseResume:file=>api.parseResume(file),
  }),[authenticated,data,error,loading,refresh,replace,setUser]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(){
  const value=useContext(DataContext);
  if(!value)throw new Error('useData must be used inside DataProvider');
  return value;
}
