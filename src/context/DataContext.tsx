import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, collectionNames, type ApiData, type ApiEntity, type CollectionName } from '../services/api';
import {
  candidates as fallbackCandidateNames,
  interviews as fallbackInterviews,
  jobs as fallbackJobs,
  projects as fallbackProjects,
} from '../services/mock';
import { useApp } from './AppContext';

const emptyCollections = Object.fromEntries(collectionNames.map((name) => [name, []])) as unknown as Record<
  CollectionName,
  ApiEntity[]
>;

const fallbackData: ApiData = {
  ...emptyCollections,
  projects: fallbackProjects as unknown as ApiEntity[],
  jobs: fallbackJobs as unknown as ApiEntity[],
  interviews: fallbackInterviews as unknown as ApiEntity[],
  candidates: fallbackCandidateNames.map((name, index) => ({
    key: String(index + 1),
    name,
    status: '可邀约',
    contact: `138****${2468 + index * 113}`,
  })),
  settings: {},
};

type DataContextValue = ApiData & {
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  createRecord: (collection: CollectionName, values: Record<string, unknown>) => Promise<ApiEntity>;
  updateRecord: (collection: CollectionName, key: string, values: Record<string, unknown>) => Promise<ApiEntity>;
  deleteRecord: (collection: CollectionName, key: string) => Promise<void>;
  inviteCandidates: (values: Record<string, unknown>) => Promise<ApiEntity[]>;
  reissueInterview: (key: string) => Promise<ApiEntity>;
  reviewInterview: (key: string, values: Record<string, unknown>) => Promise<ApiEntity>;
  completeInterview: (key: string, values: Record<string, unknown>) => Promise<ApiEntity>;
  createMeeting: (values: Record<string, unknown>) => Promise<ApiEntity>;
  syncMeeting: (key: string) => Promise<ApiEntity>;
  downloadRecords: (collection: CollectionName) => Promise<void>;
  updateSettings: (values: Record<string, unknown>) => Promise<Record<string, unknown>>;
  testFeishu: () => Promise<{connected:boolean;latency:number;checkedAt:string}>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { role } = useApp();
  const [data, setData] = useState<ApiData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.bootstrap(role));
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const replaceRecord = useCallback((collection: CollectionName, record: ApiEntity) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.key === record.key ? record : item)),
    }));
  }, []);

  const createRecord = useCallback(async (
    collection: CollectionName,
    values: Record<string, unknown>,
  ) => {
    const record = await api.create(collection, values, role);
    setData((current) => ({ ...current, [collection]: [record, ...current[collection]] }));
    return record;
  }, [role]);

  const updateRecord = useCallback(async (
    collection: CollectionName,
    key: string,
    values: Record<string, unknown>,
  ) => {
    const record = await api.update(collection, key, values, role);
    replaceRecord(collection, record);
    return record;
  }, [replaceRecord, role]);

  const deleteRecord = useCallback(async (collection: CollectionName, key: string) => {
    await api.remove(collection, key, role);
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.key !== key),
    }));
  }, [role]);

  const runInterviewAction = useCallback(async (
    action: () => Promise<ApiEntity>,
  ) => {
    const record = await action();
    replaceRecord('interviews', record);
    return record;
  }, [replaceRecord]);

  const value = useMemo<DataContextValue>(() => ({
    ...data,
    loading,
    error,
    refresh,
    createRecord,
    updateRecord,
    deleteRecord,
    inviteCandidates: async (values) => {
      const records = await api.invite(values, role);
      setData((current) => ({ ...current, interviews: [...records, ...current.interviews] }));
      return records;
    },
    reissueInterview: (key) => runInterviewAction(() => api.reissue(key, role)),
    reviewInterview: (key, values) => runInterviewAction(() => api.review(key, values, role)),
    completeInterview: (key, values) => runInterviewAction(() => api.complete(key, values, role)),
    createMeeting: async (values) => {
      const record = await api.createMeeting(values, role);
      setData((current) => ({ ...current, interviews: [record, ...current.interviews] }));
      return record;
    },
    syncMeeting: (key) => runInterviewAction(() => api.syncMeeting(key, role)),
    downloadRecords: (collection) => api.download(collection, role),
    updateSettings: async (values) => {
      const settings = await api.updateSettings(values, role);
      setData((current) => ({ ...current, settings }));
      return settings;
    },
    testFeishu: () => api.testFeishu(role),
  }), [
    createRecord,
    data,
    deleteRecord,
    error,
    loading,
    refresh,
    replaceRecord,
    role,
    runInterviewAction,
    updateRecord,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside DataProvider');
  return value;
}
