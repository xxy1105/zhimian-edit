import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export const roles = ['超级管理员','项目经理','岗位负责人','招聘专员','面试官','审核人员','数据观察员','外部客户'] as const;
export type Role = typeof roles[number];
export type CurrentUser = { id:string; name:string; role:Role; projectKeys?:string[]; jobKeys?:string[] };

type ContextValue = {
  role: Role;
  user?: CurrentUser;
  setUser: (user?: CurrentUser) => void;
  compact: boolean;
  setCompact: (compact: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
  dataScope: string;
};

const AppContext = createContext<ContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>();
  const [compact, setCompact] = useState(false);
  const role = user?.role || '数据观察员';
  const value = useMemo(() => ({
    role, user, setUser, compact, setCompact,
    canEdit: !['数据观察员','外部客户','面试官'].includes(role),
    canDelete: role === '超级管理员',
    dataScope: role === '超级管理员' ? '全部组织数据' : '服务端授权的项目与岗位范围',
  }), [role, user, compact]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
