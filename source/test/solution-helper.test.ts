/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';

import { SolutionHelper } from '../lib/solution-helper';
import { KafkaAccessControl } from '../lib/msk-cluster';

let stack: cdk.Stack;

beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
});

test('creates solution helper without any optional properties', () => {
    new SolutionHelper(stack, 'Helper', {
        solutionId: 'SO9999',
        pattern: 'test-pattern'
    });

});

test('creates solution helper with optional properties', () => {
    new SolutionHelper(stack, 'Helper', {
        solutionId: 'SO9999',
        pattern: 'test-pattern',

        shardCount: 2,
        retentionHours: 24,
        enhancedMonitoring: 'false',

        bufferingSize: 5,
        bufferingInterval: 300,
        compressionFormat: 'GZIP',

        brokerInstanceType: 'kafka.m5.large',
        numberOfBrokerNodes: 2,
        monitoringLevel: 'DEFAULT',
        accessControlMethod: KafkaAccessControl.IAM
    });

});
