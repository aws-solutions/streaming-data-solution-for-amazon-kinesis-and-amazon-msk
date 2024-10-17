/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';
import { aws_kinesis as kinesis } from 'aws-cdk-lib';

import { DeliveryStream, CompressionFormat, FeatureStatus } from '../lib/kdf-delivery-stream';

test('creates a KDF delivery stream', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const testStream = new kinesis.Stream(stack, 'TestStream');

    const kdf = new DeliveryStream(stack, 'TestDeliveryStream', {
        inputDataStream: testStream,
        bufferingInterval: 60,
        bufferingSize: 1,
        compressionFormat: CompressionFormat.GZIP,
        dataPrefix: 'data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/',
        errorsPrefix: 'errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}',
        dynamicPartitioning: FeatureStatus.Enabled,
        newLineDelimiter: FeatureStatus.Disabled,
        jqExpression: '{ foo: .bar }',
        retryDuration: 300
    });

    expect(kdf.DeliveryStreamArn).not.toBeUndefined();
    expect(kdf.DeliveryStreamName).not.toBeUndefined();
    expect(kdf.OutputBucket).not.toBeUndefined();
});
