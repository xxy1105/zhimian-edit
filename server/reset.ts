import { Store } from './store.ts';

const database = await new Store().reset();
console.log(`测试数据库已重置：${database.projects.length} 个项目，${database.candidates.length} 名候选人`);

