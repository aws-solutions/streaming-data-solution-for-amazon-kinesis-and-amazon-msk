/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { KafkaMetadata } from '../lib/msk-custom-resource';

test('creates custom resource for cluster metadata', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new KafkaMetadata(stack, 'Msk', {
        clusterArn: 'my-cluster-arn'
    });


    Template.fromStack(stack).hasResource('AWS::IAM::Role', {
        Metadata: {
            cfn_nag: {
                rules_to_suppress: [{
                    id: 'W11',
                    reason: 'MSK actions do not support resource level permissions'
                }]
            }
        }
    });
});