import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { AppProvider } from './context/AppContext';
import { DataProvider } from './context/DataContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{
      token: {
        colorPrimary:'#1677ff', colorInfo:'#1677ff', colorSuccess:'#20a162',
        colorWarning:'#e68a00', colorError:'#d9363e', colorText:'#1f2329',
        colorTextSecondary:'#646a73', colorBgLayout:'#f3f6f9', colorBorderSecondary:'#e5eaf0',
        borderRadius:6, borderRadiusLG:8, fontFamily:'"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',
      },
      components: {
        Layout:{headerBg:'#ffffff',siderBg:'#122033'},
        Menu:{darkItemBg:'#122033',darkSubMenuItemBg:'#0d1827',darkItemSelectedBg:'#1677ff'},
        Table:{headerBg:'#f7f9fb',headerColor:'#47505e',rowHoverBg:'#f3f8ff',cellPaddingBlock:13},
        Card:{headerFontSize:15},
      },
    }}>
      <AntApp><AppProvider><DataProvider><HashRouter><App /></HashRouter></DataProvider></AppProvider></AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
