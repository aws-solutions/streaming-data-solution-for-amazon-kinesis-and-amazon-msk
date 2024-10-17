/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Template} from 'aws-cdk-lib/assertions';

import { KafkaMonitoring } from '../lib/msk-monitoring';

test('creates custom resource for CloudWatch dashboard', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new KafkaMonitoring(stack, 'Monitoring', {
        clusterArn: 'my-cluster-arn',
        dashboardName: 'my-dashboard'
    });

    Template.fromStack(stack).hasResource('AWS::IAM::Role', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'DescribeCluster does not support resource level permissions'
                }]
            }
        }
    });
});