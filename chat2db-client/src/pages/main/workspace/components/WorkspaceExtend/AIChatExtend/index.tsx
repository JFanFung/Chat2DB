import React, { useEffect, useState, useMemo, useRef } from 'react';
import AIChatPanel, { IAIChatPanelRef } from '@/components/AIChatPanel';
import { useWorkspaceStore } from '@/pages/main/workspace/store';
import { useTreeStore } from '@/blocks/Tree/treeStore';
import sqlServer from '@/service/sql';
import { IBoundInfo } from '@/typings';
import { message } from 'antd';
import i18n from '@/i18n';
import styles from './index.less';

const AIChatExtend = () => {
  const aiChatPanelRef = useRef<IAIChatPanelRef>(null);
  const [tables, setTables] = useState<string[]>([]);
  
  const { currentConnectionDetails, workspaceTabList, activeConsoleId } = useWorkspaceStore((state) => ({
    currentConnectionDetails: state.currentConnectionDetails,
    workspaceTabList: state.workspaceTabList,
    activeConsoleId: state.activeConsoleId,
  }));

  const focusTreeNode = useTreeStore((state) => state.focusTreeNode);

  const boundInfo = useMemo<IBoundInfo | null>(() => {
    if (!currentConnectionDetails) {
      return null;
    }

    const activeTab = workspaceTabList?.find(tab => tab.id === activeConsoleId);
    
    return {
      dataSourceId: activeTab?.uniqueData?.dataSourceId || currentConnectionDetails.id,
      dataSourceName: activeTab?.uniqueData?.dataSourceName || currentConnectionDetails.alias,
      databaseType: activeTab?.uniqueData?.databaseType || currentConnectionDetails.type,
      databaseName: activeTab?.uniqueData?.databaseName || focusTreeNode?.databaseName || '',
      schemaName: activeTab?.uniqueData?.schemaName || focusTreeNode?.schemaName || '',
      consoleId: activeTab?.id as number,
      status: activeTab?.uniqueData?.status,
      connectable: activeTab?.uniqueData?.connectable,
      supportDatabase: activeTab?.uniqueData?.supportDatabase,
      supportSchema: activeTab?.uniqueData?.supportSchema,
    };
  }, [currentConnectionDetails, workspaceTabList, activeConsoleId, focusTreeNode]);

  useEffect(() => {
    if (boundInfo?.dataSourceId && (boundInfo.databaseName || boundInfo.schemaName)) {
      fetchTables();
    }
  }, [boundInfo?.dataSourceId, boundInfo?.databaseName, boundInfo?.schemaName]);

  const fetchTables = async () => {
    if (!boundInfo) return;
    
    try {
      const res = await sqlServer.getTableList({
        dataSourceId: boundInfo.dataSourceId,
        databaseName: boundInfo.databaseName || '',
        schemaName: boundInfo.schemaName,
        databaseType: boundInfo.databaseType,
        pageNo: 1,
        pageSize: 1000,
      });
      
      const tableNames = res?.data?.map((t: any) => t.name || t.tableName) || [];
      setTables(tableNames);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      setTables([]);
    }
  };

  const handleExecuteSQL = (sql: string) => {
    message.success(i18n('aiChat.sqlApplied'));
  };

  if (!boundInfo) {
    return (
      <div className={styles.emptyState}>
        <p>{i18n('aiChat.selectConnection')}</p>
      </div>
    );
  }

  return (
    <div className={styles.aiChatExtend}>
      <AIChatPanel
        ref={aiChatPanelRef}
        boundInfo={boundInfo}
        tables={tables}
        onExecuteSQL={handleExecuteSQL}
      />
    </div>
  );
};

export default AIChatExtend;
