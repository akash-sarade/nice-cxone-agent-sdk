import { AuthStatus } from '@nice-devone/auth-sdk';
import { CXoneLeaderElector, MessageBus, MessageType, Queue } from '@nice-devone/common-sdk';
import { ACDSessionManager, ApiUriConstants, HttpUtilService, LoadWorker, Logger, UrlUtilsService, } from '@nice-devone/core-sdk';
/**
 * Agent Queues Provider Class
 */
export class CXoneAgentQueuesProvider {
    /**
     * Creates agent queue provider
     * @example - const provider = new CXoneAgentQueuesProvider()
     */
    constructor() {
        this.logger = new Logger('SDK', 'CXoneAgentQueuesProvider');
        this.acdSession = ACDSessionManager.instance;
        this.baseUri = '';
        this.utilService = new HttpUtilService();
        this.cxoneClient = {};
        this.urlUtilService = new UrlUtilsService();
        this.agentId = '';
        window.addEventListener(AuthStatus.REFRESH_TOKEN_SUCCESS, () => this.restartWorker(this.agentId));
    }
    /**
     * Used to set the directory base instance to access the subject from the base class
     * @example -
     * ```
     * const agentQueuesProvider = new CXoneAgentQueuesProvider();
     * agentQueuesProvider.setACDSdkBaseInstance(this);
     * ```
     */
    setACDSdkBaseInstance(cxoneClient) {
        this.cxoneClient = cxoneClient;
    }
    /**
     * Used to initiate the polling for agent queue data
     * @example -
     * ```
     * const agentQueuesProvider = new CXoneAgentQueuesProvider();
     * this.agentQueuesProvider.agentQueuesPolling();
     * ```
     */
    agentQueuesPolling(agentId) {
        this.agentId = agentId;
        if (this.pollingWorker) {
            this.logger.info('agentQueuesPolling', 'agentQueuesPolling is already started');
            return;
        }
        this.logger.info('agentQueuesPolling', 'agentQueuesPolling in CXoneAgentQueuesProvider');
        this.baseUri = this.acdSession.cxOneConfig.acdApiBaseUri;
        const authToken = this.acdSession.accessToken;
        const requestParams = {
            fields: '',
            updatedSince: new Date(0).toISOString(),
        };
        if (this.baseUri && authToken) {
            const queueUri = ApiUriConstants.AGENT_QUEUE_URI.replace('{agentId}', agentId);
            const url = this.baseUri +
                this.urlUtilService.appendQueryString(queueUri, requestParams);
            const reqInit = {
                headers: this.utilService.initHeader(authToken).headers,
            };
            if (!this.pollingWorker) {
                this.initAgentQueuesWorker();
                this.pollingWorker.onmessage = (response) => {
                    this.handleAgentQueueResponse(response.data);
                };
            }
            this.pollingWorker.postMessage({
                type: 'agent-polling',
                requestParams: { url: url, method: 'GET', request: reqInit },
            });
        }
    }
    /**
     * Callback method which will passed on to the worker and will be executed after the polling api response
     * then will publish to the subject subscriber with the agent queue data
     * @param response - agent queue api response object
     * @example -
     * ```
     * handleAgentQueueResponse(data);
     * ```
     */
    handleAgentQueueResponse(response) {
        if (response) {
            if (CXoneLeaderElector.instance.isLeader) {
                const msg = {
                    type: MessageType.AGENT_QUEUE_POLLING_RESPONSE,
                    data: response,
                };
                MessageBus.instance.postResponse(msg);
            }
            const agentQueues = this.formatAgentQueueResponse(response);
            this.cxoneClient.skillActivityQueue.agentQueueSubject.next(agentQueues);
        }
    }
    /**
     * This method to format agent queues api response and return the agent queue model object
     * @param response -  agent queue api response object
     * @returns - agent queue
     * @example -
     * ```
     * formatAgentQueueResponse(response);
     * ```
     */
    formatAgentQueueResponse(response) {
        var _a;
        const agentQueues = {};
        if (((_a = response === null || response === void 0 ? void 0 : response.resultSet) === null || _a === void 0 ? void 0 : _a.queues) && response.resultSet.queues.length > 0) {
            response.resultSet.queues.forEach((queue) => {
                const queueData = new Queue();
                queueData.parse(queue);
                agentQueues[queue.skillId] = queueData;
            });
        }
        return agentQueues;
    }
    /**
     * Use to initializing the util worker and will return the method inside the worker
     * @example
     * ```
     * this.initAgentQueuesWorker();
     * ```
     */
    initAgentQueuesWorker() {
        const loader = new LoadWorker();
        this.pollingWorker = loader.getWorker('util-worker', 'ccf-agent-queue-polling-worker');
    }
    /**
     * Use to restart worker
     * @example
     * ```
     * this.restartWorker(agentId: string);
     * ```
     */
    restartWorker(agentId) {
        if (this.pollingWorker) {
            this.terminatePolling();
            this.agentQueuesPolling(agentId);
        }
    }
    /**
     * Use to terminate the agent queue worker
     * @example -
     * ```
     * this.terminatePolling
     * ```
     */
    terminatePolling() {
        var _a;
        (_a = this.pollingWorker) === null || _a === void 0 ? void 0 : _a.terminate();
        this.pollingWorker = undefined;
    }
}
//# sourceMappingURL=cxone-agent-queues-provider.js.map