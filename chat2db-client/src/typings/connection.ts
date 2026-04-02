import { DatabaseTypeCode } from '@/constants';

// 连接 高级配置列表的信息
export interface IConnectionExtendInfoItem {
  key: string;
  value: string;
}

// 连接的环境信息
export interface IConnectionEnv {
  id: number;
  name: string;
  shortName: string;
  color: string;
}

// 连接分组信息
export interface IConnectionGroup {
  id: number;
  name: string;
  parentId?: number;
}

// 连接列表的信息
export interface IConnectionListItem {
  id: number;
  alias: string;
  environment: IConnectionEnv;
  type: DatabaseTypeCode;
  supportDatabase: boolean;
  supportSchema: boolean;
  user: string;
  groupId?: number;
  groupName?: string;
}


export interface IConnectionDetails {
  id: number;
  alias: string;
  environment: IConnectionEnv;
  type: DatabaseTypeCode;

  isAdmin: boolean;
  url: string;
  user: string;
  password: string;
  ConsoleOpenedStatus: 'y' | 'n';
  extendInfo: IConnectionExtendInfoItem[];
  environmentId: number;
  groupId?: number;
  groupName?: string;
  ssh: any;
  driverConfig: {
    jdbcDriver: string;
    jdbcDriverClass: string;
  };
  [key: string]: any;
}



export type ICreateConnectionDetails = Omit<IConnectionDetails, 'id'>

