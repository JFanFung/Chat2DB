import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Spin, Button, Tooltip, Select, Radio, Space, Modal } from 'antd';
import Iconfont from '@/components/Iconfont';
import i18n from '@/i18n';
import { formatParams } from '@/utils/url';
import connectToEventSource from '@/utils/eventSource';
import sqlServer, { IExecuteSqlParams } from '@/service/sql';
import aiServer from '@/service/ai';
import configService from '@/service/config';
import { useSettingStore, fetchRemainingUse, setAiConfig } from '@/store/setting';
import { chatErrorForKey, chatErrorToLogin } from '@/constants/chat';
import { AIType } from '@/typings/ai';
import { IBoundInfo } from '@/typings';
import Popularize from '@/components/Popularize';
import { MessageType, IChatMessage } from './types';
import styles from './index.less';

enum IPromptType {
  NL_2_SQL = 'NL_2_SQL',
  ChatRobot = 'ChatRobot',
}

interface IProps {
  boundInfo: IBoundInfo;
  tables?: string[];
  onExecuteSQL?: (sql: string) => void;
}

export interface IAIChatPanelRef {
  clearMessages: () => void;
  addMessage: (message: Partial<IChatMessage>) => void;
}

const defaultResultConfig = {
  pageNo: 1,
  pageSize: 200,
  total: 0,
  hasNextPage: true,
};

const AIChatPanel = forwardRef<IAIChatPanelRef, IProps>((props, ref) => {
  const { boundInfo, tables = [], onExecuteSQL } = props;
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStream, setIsStream] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [syncTableModel, setSyncTableModel] = useState<number>(0);
  const [popularizeModal, setPopularizeModal] = useState(false);
  const [modalProps, setModalProps] = useState<any>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const closeEventSource = useRef<any>();
  const aiFetchIntervalRef = useRef<any>();
  const chatResultRef = useRef('');
  
  const { aiConfig, hasWhite, remainingUse } = useSettingStore((state) => ({
    aiConfig: state.aiConfig,
    hasWhite: state.hasWhite,
    remainingUse: state.remainingUse,
  }));

  const isChat2DBAI = aiConfig?.aiSqlSource === AIType.CHAT2DBAI;

  useEffect(() => {
    const syncModel = localStorage.getItem('syncTableModel');
    if (syncModel !== null) {
      setSyncTableModel(Number(syncModel));
    } else {
      setSyncTableModel(hasWhite ? 0 : 1);
    }
  }, [hasWhite]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useImperativeHandle(ref, () => ({
    clearMessages: () => setMessages([]),
    addMessage: (message) => {
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: MessageType.USER,
        content: '',
        timestamp: Date.now(),
        ...message,
      }]);
    },
  }));

  const handleApiKeyEmptyOrGetQrCode = async (shouldPoll?: boolean) => {
    setIsLoading(true);
    try {
      const { wechatQrCodeUrl, token, tip } = await aiServer.getLoginQrCode({});
      setIsLoading(false);
      setPopularizeModal(true);
      setModalProps({ imageUrl: wechatQrCodeUrl, token, tip });
      if (shouldPoll) {
        let pollCnt = 0;
        aiFetchIntervalRef.current = setInterval(async () => {
          const { apiKey } = (await aiServer.getLoginStatus({ token })) || {};
          pollCnt++;
          if (apiKey || pollCnt >= 60) {
            clearInterval(aiFetchIntervalRef.current);
          }
          if (apiKey) {
            setPopularizeModal(false);
            setAiConfig({ ...(aiConfig || {}), apiKey });
            fetchRemainingUse(apiKey);
          }
        }, 3000);
      }
    } catch (e) {
      setIsLoading(false);
    }
  };

  const handlePopUp = () => {
    setModalProps({
      imageUrl: 'http://oss.sqlgpt.cn/static/chat2db-wechat.jpg?x-oss-process=image/auto-orient,1/resize,m_lfit,w_256/quality,Q_80/format,webp',
      tip: (
        <>
          {remainingUse?.remainingUses === 0 && <p>Key次数用完或者过期</p>}
          <p>微信扫描二维码并关注公众号获得 AI 使用机会。</p>
        </>
      ),
    });
    setPopularizeModal(true);
  };

  const executeSQL = async (sql: string, messageId: string) => {
    updateMessage(messageId, { executeStatus: 'executing' });
    
    const executeSQLParams: IExecuteSqlParams = {
      sql,
      ...defaultResultConfig,
      dataSourceId: boundInfo.dataSourceId,
      databaseName: boundInfo.databaseName,
      schemaName: boundInfo.schemaName,
      type: boundInfo.databaseType,
    };

    try {
      const res = await sqlServer.executeSql(executeSQLParams);
      const result = res[0];
      
      if (result.success) {
        updateMessage(messageId, {
          executeStatus: 'success',
          executeResult: {
            success: true,
            data: result.dataList,
            headerList: result.headerList,
            updateCount: result.updateCount,
            duration: result.duration,
          },
        });
      } else {
        updateMessage(messageId, {
          executeStatus: 'error',
          executeResult: {
            success: false,
            message: result.message,
          },
        });
      }
    } catch (error: any) {
      updateMessage(messageId, {
        executeStatus: 'error',
        executeResult: {
          success: false,
          message: error.message || 'SQL execution failed',
        },
      });
    }
  };

  const updateMessage = (id: string, updates: Partial<IChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!window._BaseURL) {
      const aiMessage: IChatMessage = {
        id: uuidv4(),
        type: MessageType.ERROR,
        content: i18n('aiChat.serverNotConfigured'),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: MessageType.USER,
        content: inputValue.trim(),
        timestamp: Date.now(),
      }, aiMessage]);
      setInputValue('');
      return;
    }

    const userMessage: IChatMessage = {
      id: uuidv4(),
      type: MessageType.USER,
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    const aiMessage: IChatMessage = {
      id: uuidv4(),
      type: MessageType.AI,
      content: '',
      timestamp: Date.now(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, aiMessage]);
    setInputValue('');
    setIsLoading(true);
    chatResultRef.current = '';

    const _aiConfig = await configService.getAiSystemConfig({});
    const { apiKey } = _aiConfig || aiConfig || {};
    
    if (!apiKey && isChat2DBAI) {
      handleApiKeyEmptyOrGetQrCode(true);
      setIsLoading(false);
      updateMessage(aiMessage.id, { isLoading: false, type: MessageType.ERROR, content: i18n('aiChat.pleaseLogin') });
      return;
    }

    const { dataSourceId, databaseName, schemaName } = boundInfo;
    const params = formatParams({
      message: userMessage.content,
      promptType: IPromptType.NL_2_SQL,
      dataSourceId,
      databaseName,
      schemaName,
      tableNames: syncTableModel ? selectedTables : null,
    });

    const handleMessage = (_message: string) => {
      setIsLoading(false);
      try {
        const isEOF = _message === '[DONE]';
        if (isEOF) {
          closeEventSource.current?.();
          setIsStream(false);
          if (isChat2DBAI) {
            fetchRemainingUse(apiKey);
          }
          
          const generatedSQL = chatResultRef.current.trim();
          updateMessage(aiMessage.id, { 
            isLoading: false, 
            content: generatedSQL,
            sql: generatedSQL,
            executeStatus: 'pending',
          });
          
          if (generatedSQL) {
            executeSQL(generatedSQL, aiMessage.id);
          }
          chatResultRef.current = '';
          return;
        }

        if (_message.includes('[ERROR]')) {
          closeEventSource.current?.();
          setIsStream(false);
          setIsLoading(false);
          const errorMatch = _message.match(/"content":"([^"]+)"/);
          const errorMessage = errorMatch ? errorMatch[1] : i18n('aiChat.requestFailed');
          
          if (errorMessage.includes('Rest AI Error')) {
            // 提取详细错误信息
            const detailedError = errorMessage.replace('Rest AI Error', '');
            updateMessage(aiMessage.id, { 
              isLoading: false, 
              type: MessageType.ERROR, 
              content: i18n('aiChat.restAIError') + (detailedError ? `: ${detailedError}` : '') 
            });
          } else {
            updateMessage(aiMessage.id, { isLoading: false, type: MessageType.ERROR, content: errorMessage });
          }
          return;
        }

        let hasErrorToLogin = false;
        chatErrorToLogin.forEach((err) => {
          if (_message.includes(err)) {
            hasErrorToLogin = true;
          }
        });
        let hasKeyLimitedOrExpired = false;
        chatErrorForKey.forEach((err) => {
          if (_message.includes(err)) {
            hasKeyLimitedOrExpired = true;
          }
        });

        if (hasKeyLimitedOrExpired) {
          closeEventSource.current?.();
          setIsLoading(false);
          handlePopUp();
          updateMessage(aiMessage.id, { isLoading: false, type: MessageType.ERROR, content: i18n('aiChat.keyExpired') });
          return;
        }

        if (hasErrorToLogin) {
          closeEventSource.current?.();
          setIsLoading(false);
          handleApiKeyEmptyOrGetQrCode(true);
          fetchRemainingUse(apiKey);
          updateMessage(aiMessage.id, { isLoading: false, type: MessageType.ERROR, content: i18n('aiChat.pleaseLogin') });
          return;
        }

        chatResultRef.current += JSON.parse(_message).content;
        updateMessage(aiMessage.id, { content: chatResultRef.current });
      } catch (error) {
        setIsLoading(false);
        setIsStream(false);
        closeEventSource.current?.();
        updateMessage(aiMessage.id, { isLoading: false, type: MessageType.ERROR, content: i18n('aiChat.parseError') });
      }
    };

    const handleError = (error: any) => {
      console.error('Error:', error);
      setIsLoading(false);
      setIsStream(false);
      closeEventSource.current?.();
      updateMessage(aiMessage.id, { isLoading: false, type: MessageType.ERROR, content: error.message || i18n('aiChat.requestFailed') });
    };

    closeEventSource.current = connectToEventSource({
      url: `/api/ai/chat?${params}`,
      uid: uuidv4(),
      onOpen: () => {
        setIsStream(true);
      },
      onMessage: handleMessage,
      onError: handleError,
    });
  };

  const handleCancelStream = () => {
    closeEventSource.current?.();
    setIsStream(false);
    setIsLoading(false);
  };

  const handleReExecute = (message: IChatMessage) => {
    if (message.sql) {
      executeSQL(message.sql, message.id);
    }
  };

  const handleCopySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
  };

  const handleUseInEditor = (sql: string) => {
    onExecuteSQL?.(sql);
  };

  const renderMessage = (message: IChatMessage) => {
    const isUser = message.type === MessageType.USER;
    const isAI = message.type === MessageType.AI;
    const isError = message.type === MessageType.ERROR;

    return (
      <div 
        key={message.id} 
        className={`${styles.messageItem} ${isUser ? styles.userMessage : styles.aiMessage}`}
      >
        <div className={styles.messageAvatar}>
          {isUser ? (
            <Iconfont code="&#xe617;" size={24} />
          ) : (
            <Iconfont code="&#xe60a;" size={24} />
          )}
        </div>
        <div className={styles.messageContent}>
          {isUser ? (
            <div className={styles.userText}>{message.content}</div>
          ) : message.isLoading ? (
            <div className={styles.loadingDots}>
              <Spin size="small" />
              <span>{i18n('aiChat.thinking')}</span>
            </div>
          ) : (
            <>
              {isError ? (
                <div className={styles.errorText}>{message.content}</div>
              ) : (
                <>
                  {message.sql && (
                    <div className={styles.sqlBlock}>
                      <div className={styles.sqlHeader}>
                        <span className={styles.sqlLabel}>SQL</span>
                        <div className={styles.sqlActions}>
                          <Tooltip title={i18n('common.button.copy')}>
                            <Button 
                              type="text" 
                              size="small"
                              icon={<Iconfont code="&#xe634;" size={14} />}
                              onClick={() => handleCopySQL(message.sql!)}
                            />
                          </Tooltip>
                          <Tooltip title={i18n('aiChat.useInEditor')}>
                            <Button 
                              type="text" 
                              size="small"
                              icon={<Iconfont code="&#xe63a;" size={14} />}
                              onClick={() => handleUseInEditor(message.sql!)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                      <pre className={styles.sqlCode}>{message.sql}</pre>
                    </div>
                  )}
                  
                  {message.executeStatus && message.executeStatus !== 'pending' && (
                    <div className={styles.executeResult}>
                      {message.executeStatus === 'executing' && (
                        <div className={styles.executingStatus}>
                          <Spin size="small" />
                          <span>{i18n('aiChat.executing')}</span>
                        </div>
                      )}
                      {message.executeStatus === 'success' && message.executeResult && (
                        <div className={styles.successResult}>
                          <div className={styles.resultHeader}>
                            <Iconfont code="&#ue605;" size={16} className={styles.successIcon} />
                            <span>{i18n('aiChat.executeSuccess')}</span>
                            {message.executeResult.duration && (
                              <span className={styles.duration}>
                                {i18n('common.text.timeConsuming', message.executeResult.duration + 'ms')}
                              </span>
                            )}
                          </div>
                          {message.executeResult.data && message.executeResult.data.length > 0 && (
                            <div className={styles.dataPreview}>
                              <div className={styles.dataTable}>
                                <table>
                                  <thead>
                                    <tr>
                                      {message.executeResult.headerList?.map((header: any, idx: number) => (
                                        <th key={idx}>{header.name || header}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {message.executeResult.data.slice(0, 5).map((row: any, rowIdx: number) => (
                                      <tr key={rowIdx}>
                                        {message.executeResult.headerList?.map((header: any, colIdx: number) => (
                                          <td key={colIdx}>{String(row[header.name || header] ?? '')}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {message.executeResult.data.length > 5 && (
                                  <div className={styles.moreData}>
                                    {i18n('aiChat.moreRows', message.executeResult.data.length - 5)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {message.executeResult.updateCount !== undefined && message.executeResult.updateCount > 0 && (
                            <div className={styles.updateCount}>
                              {i18n('common.text.affectedRows', message.executeResult.updateCount)}
                            </div>
                          )}
                        </div>
                      )}
                      {message.executeStatus === 'error' && message.executeResult && (
                        <div className={styles.errorResult}>
                          <div className={styles.resultHeader}>
                            <Iconfont code="&#ue87c;" size={16} className={styles.errorIcon} />
                            <span>{i18n('aiChat.executeFailed')}</span>
                          </div>
                          <div className={styles.errorMessage}>{message.executeResult.message}</div>
                          <Button 
                            type="primary" 
                            size="small"
                            onClick={() => handleReExecute(message)}
                          >
                            {i18n('aiChat.retry')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderTableSelector = () => {
    const options = tables.map((t) => ({ value: t, label: t }));
    return (
      <div className={styles.tableSelector}>
        <Radio.Group
          onChange={(v) => {
            setSyncTableModel(v.target.value);
            localStorage.setItem('syncTableModel', String(v.target.value));
          }}
          value={syncTableModel}
          size="small"
        >
          <Space direction="horizontal">
            <Radio value={0}>{i18n('aiChat.autoSync')}</Radio>
            <Radio value={1}>{i18n('aiChat.manualSelect')}</Radio>
          </Space>
        </Radio.Group>
        {syncTableModel === 1 && (
          <Select
            showSearch
            mode="multiple"
            allowClear
            size="small"
            options={options}
            placeholder={i18n('chat.input.tableSelect.placeholder')}
            value={selectedTables}
            onChange={setSelectedTables}
            className={styles.tableSelect}
            maxTagCount={3}
          />
        )}
      </div>
    );
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className={styles.aiChatPanel}>
      <div className={styles.panelHeader}>
        <div className={styles.title}>
          <Iconfont code="&#xe60a;" size={18} />
          <span>{i18n('aiChat.title')}</span>
        </div>
        <div className={styles.headerActions}>
          {renderTableSelector()}
          <Tooltip title={i18n('aiChat.clearHistory')}>
            <Button 
              type="text" 
              size="small"
              icon={<Iconfont code="&#xe616;" size={16} />}
              onClick={clearMessages}
            />
          </Tooltip>
        </div>
      </div>
      
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <Iconfont code="&#xe60a;" size={48} />
            <p>{i18n('aiChat.welcome')}</p>
            <p className={styles.hint}>{i18n('aiChat.welcomeHint')}</p>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputContainer}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            className={styles.input}
            placeholder={i18n('aiChat.inputPlaceholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading}
          />
          {isStream ? (
            <Button 
              type="text" 
              className={styles.sendButton}
              onClick={handleCancelStream}
            >
              <Iconfont code="&#xe652;" size={18} />
            </Button>
          ) : (
            <Button 
              type="text" 
              className={styles.sendButton}
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
            >
              <Iconfont code="&#xe63a;" size={18} />
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={popularizeModal}
        footer={false}
        onCancel={() => {
          aiFetchIntervalRef.current && clearInterval(aiFetchIntervalRef.current);
          setPopularizeModal(false);
        }}
      >
        <Popularize {...modalProps} />
      </Modal>
    </div>
  );
});

export default AIChatPanel;
