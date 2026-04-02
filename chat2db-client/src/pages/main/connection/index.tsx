import React, { useRef, useState, Fragment, useEffect } from 'react';
import { Button, Dropdown, Tree, Input, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import i18n from '@/i18n';
// import RefreshLoadingButton from '@/components/RefreshLoadingButton';

// ----- services -----
import connectionService from '@/service/connection';

// ----- constants/typings -----
import { databaseMap } from '@/constants';
import { IConnectionDetails, IConnectionListItem, IConnectionGroup } from '@/typings';

// ----- components -----
import CreateConnection from '@/blocks/CreateConnection';
import Iconfont from '@/components/Iconfont';
import LoadingContent from '@/components/Loading/LoadingContent';
import MenuLabel from '@/components/MenuLabel';

// ----- hooks -----
import useClickAndDoubleClick from '@/hooks/useClickAndDoubleClick';

// ----- store -----
import { useConnectionStore, getConnectionList } from '@/pages/main/store/connection';
import { setMainPageActiveTab } from '@/pages/main/store/main';
import { setCurrentConnectionDetails } from '@/pages/main/workspace/store/common';
import { getOpenConsoleList } from '@/pages/main/workspace/store/console';

import styles from './index.less';

const ConnectionsPage = () => {
  const { connectionList } = useConnectionStore((state) => {
    return {
      connectionList: state.connectionList,
    };
  });
  const volatileRef = useRef<any>();
  const [connectionActiveId, setConnectionActiveId] = useState<IConnectionListItem['id'] | null>(null);
  const [connectionDetail, setConnectionDetail] = useState<IConnectionDetails | null | undefined>(null);
  const [groupList, setGroupList] = useState<IConnectionGroup[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);

  // 处理列表单击事件
  const handleMenuItemSingleClick = (t: IConnectionListItem) => {
    if (connectionActiveId !== t.id) {
      setConnectionActiveId(t.id);
    }
  };

  // 处理列表双击事件
  const handleMenuItemDoubleClick = (t: IConnectionListItem) => {
    setCurrentConnectionDetails(t);
    setMainPageActiveTab('workspace');
  };

  // 处理列表单击和双击事件
  const handleClickConnectionMenu = useClickAndDoubleClick(handleMenuItemSingleClick, handleMenuItemDoubleClick);

  // 获取分组列表
  const fetchGroupList = async () => {
    try {
      const groups = await connectionService.getGroupList();
      setGroupList(groups);
      // 展开所有节点
      const keys = groups.map(group => group.id.toString());
      setExpandedKeys(keys);
    } catch (error) {
      console.error('Failed to get group list:', error);
    }
  };

  // 打开添加分组模态框
  const showAddGroupModal = () => {
    setGroupName('');
    setEditingGroupId(null);
    setIsGroupModalVisible(true);
  };

  // 打开编辑分组模态框
  const showEditGroupModal = (group: IConnectionGroup) => {
    setGroupName(group.name);
    setEditingGroupId(group.id);
    setIsGroupModalVisible(true);
  };

  // 保存分组
  const saveGroup = async () => {
    if (!groupName.trim()) {
      message.error('Group name cannot be empty');
      return;
    }

    try {
      if (editingGroupId) {
        await connectionService.updateGroup({ id: editingGroupId, name: groupName });
        message.success('Group updated successfully');
      } else {
        await connectionService.createGroup({ name: groupName });
        message.success('Group created successfully');
      }
      setIsGroupModalVisible(false);
      fetchGroupList();
    } catch (error) {
      console.error('Failed to save group:', error);
      message.error('Failed to save group');
    }
  };

  // 删除分组
  const deleteGroup = async (groupId: number) => {
    try {
      await connectionService.deleteGroup({ id: groupId });
      message.success('Group deleted successfully');
      fetchGroupList();
      if (selectedGroupId === groupId) {
        setSelectedGroupId(null);
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      message.error('Failed to delete group');
    }
  };

  // 组件初始化时获取分组列表
  useEffect(() => {
    fetchGroupList();
  }, []);

  // 切换连接的详情
  useEffect(() => {
    if (!connectionActiveId) {
      return;
    }
    setConnectionDetail(undefined);
    connectionService
      .getDetails({ id: connectionActiveId })
      .then((res) => {
        setConnectionDetail(res);
      })
      .catch(() => {
        setConnectionActiveId(null);
      });
  }, [connectionActiveId]);

  //
  const createDropdownItems = (t) => {
    const handelDelete = (e) => {
      // 禁止冒泡到menuItem
      e.domEvent?.stopPropagation?.();
      connectionService.remove({ id: t.id }).then(() => {
        getConnectionList().then(() => {
          // 连接删除后需要更新下 consoleList
          getOpenConsoleList();
        });
        if (connectionActiveId === t.id) {
          setConnectionActiveId(null);
          setConnectionDetail(null);
        }
      });
    };

    const enterWorkSpace = (e) => {
      e.domEvent?.stopPropagation?.();
      handleMenuItemDoubleClick(t);
    };

    const copyConnection = (e) => {
      e.domEvent?.stopPropagation?.();
      connectionService.clone({ id: t.id }).then((res) => {
        getConnectionList();
        setConnectionActiveId(res);
      });
    }

    return [
      {
        key: 'enterWorkSpace',
        label: <MenuLabel icon="&#xec57;" label={i18n('connection.button.connect')} />,
        onClick: enterWorkSpace,
      },
      {
        key: 'copyConnection',
        label: <MenuLabel icon="&#xec7a;" label={i18n('common.button.copy')} />,
        onClick: copyConnection,
      },
      {
        key: 'delete',
        label: <MenuLabel icon="&#xe6a7;" label={i18n('connection.button.remove')} />,
        onClick: handelDelete,
      },
    ];
  };

  const renderConnectionMenuList = () => {
    return connectionList?.map((t) => {
      return (
        <Dropdown
          key={t.id}
          trigger={['contextMenu']}
          menu={{
            items: createDropdownItems(t),
          }}
        >
          <div
            className={classnames(styles.menuItem, {
              [styles.menuItemActive]: connectionActiveId === t.id,
            })}
            onClick={() => {
              handleClickConnectionMenu(t);
            }}
          >
            <div className={classnames(styles.menuItemsTitle)}>
              <span className={styles.envTag} style={{ background: t.environment.color.toLocaleLowerCase() }} />
              <span className={styles.databaseTypeIcon}>
                {<Iconfont className={styles.menuItemIcon} code={databaseMap[t.type]?.icon} />}
              </span>
              <span className={styles.name}>{t.alias}</span>
              {/* <Tag color={t.environment.color.toLocaleLowerCase()}>
              {t.environment.shortName}
            </Tag> */}
            </div>
          </div>
        </Dropdown>
      );
    });
  };

  const onSubmit = (data) => {
    return connectionService
      .save({
        ...data,
      })
      .then((res) => {
        getConnectionList();
        setConnectionActiveId(res);
      });
  };

  // 渲染分组树
  const renderGroupTree = () => {
    const treeData = groupList.map(group => ({
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{group.name}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <EditOutlined size={14} onClick={() => showEditGroupModal(group)} />
            <DeleteOutlined size={14} onClick={() => deleteGroup(group.id)} />
          </div>
        </div>
      ),
      key: group.id.toString(),
      value: group.id,
    }));

    return (
      <div className={styles.groupTreeContainer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Groups</h3>
          <Button type="text" icon={<PlusOutlined />} size="small" onClick={showAddGroupModal}>
            Add Group
          </Button>
        </div>
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpandedKeysChange={setExpandedKeys}
          selectedKeys={selectedGroupId ? [selectedGroupId.toString()] : []}
          onSelect={(selectedKeys) => {
            setSelectedGroupId(selectedKeys.length > 0 ? parseInt(selectedKeys[0]) : null);
          }}
        />
      </div>
    );
  };

  // 过滤连接列表
  const filteredConnections = selectedGroupId 
    ? connectionList.filter(conn => conn.groupId === selectedGroupId)
    : connectionList;

  // 渲染连接列表
  const renderConnectionMenuList = () => {
    return filteredConnections?.map((t) => {
      return (
        <Dropdown
          key={t.id}
          trigger={['contextMenu']}
          menu={{
            items: createDropdownItems(t),
          }}
        >
          <div
            className={classnames(styles.menuItem, {
              [styles.menuItemActive]: connectionActiveId === t.id,
            })}
            onClick={() => {
              handleClickConnectionMenu(t);
            }}
          >
            <div className={classnames(styles.menuItemsTitle)}>
              <span className={styles.envTag} style={{ background: t.environment.color.toLocaleLowerCase() }} />
              <span className={styles.databaseTypeIcon}>
                {<Iconfont className={styles.menuItemIcon} code={databaseMap[t.type]?.icon} />}
              </span>
              <span className={styles.name}>{t.alias}</span>
            </div>
          </div>
        </Dropdown>
      );
    });
  };

  return (
    <>
      <div className={styles.box}>
        <div ref={volatileRef} className={styles.layoutLeft}>
          {renderGroupTree()}
          <div className={styles.pageTitle}>{i18n('connection.title.connections')}</div>
          <div className={styles.menuBox}>{renderConnectionMenuList()}</div>
          <Button
            type="primary"
            className={styles.addConnection}
            onClick={() => {
              setConnectionActiveId(null);
              setConnectionDetail(null);
            }}
          >
            {i18n('connection.button.addConnection')}
          </Button>
        </div>
        <LoadingContent
          className={styles.layoutRight}
          isLoading={connectionDetail === undefined && !!connectionActiveId}
        >
          <CreateConnection connectionDetail={connectionDetail} onSubmit={onSubmit} />
        </LoadingContent>
      </div>
      
      {/* 分组管理模态框 */}
      <Modal
        title={editingGroupId ? 'Edit Group' : 'Add Group'}
        open={isGroupModalVisible}
        onOk={saveGroup}
        onCancel={() => setIsGroupModalVisible(false)}
      >
        <Input
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          style={{ marginBottom: '16px' }}
        />
      </Modal>
    </>
  );
};

export default ConnectionsPage;
