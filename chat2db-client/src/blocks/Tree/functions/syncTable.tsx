// 同步表结构
import React from 'react';
import { Modal } from 'antd';
import TableSync from '@/blocks/TableSync';

export const syncTable = (treeNodeData) => {
  Modal.open({
    title: 'Sync Table Structure',
    width: '800px',
    footer: false,
    content: (
      <TableSync
        visible={true}
        onClose={() => Modal.destroyAll()}
        onSuccess={() => {
          // 同步成功后的回调
          console.log('Table sync successful');
        }}
        sourceDataSourceId={treeNodeData.extraParams?.dataSourceId}
        sourceDatabaseName={treeNodeData.extraParams?.databaseName}
        sourceSchemaName={treeNodeData.extraParams?.schemaName}
        sourceTableName={treeNodeData.name}
      />
    ),
  });
};