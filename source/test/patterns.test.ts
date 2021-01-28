/*********************************************************************************************************************
 *  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import * as cdk from '@aws-cdk/core';

import { ApiGwKdsLambda } from '../patterns/apigw-kds-lambda';
import { KplKdsKda } from '../patterns/kpl-kds-kda';
import { KdsKdfS3 } from '../patterns/kds-kdf-s3';
import { KdsKdaApiGw } from '../patterns/kds-kda-apigw';
import { MskStandalone } from '../patterns/msk-standalone-cluster';
import { MskLambda } from '../patterns/msk-lambda';
import { MskLambdaKdf } from '../patterns/msk-lambda-kdf';
import { MskKdaS3 } from '../patterns/msk-kda-s3';

let app: cdk.App;
beforeEach(() => app = new cdk.App());

test('creates the apigw-kds-lambda pattern', () => {
    new ApiGwKdsLambda(app, 'apigw-kds-lambda', { description: 'apigw-kds-lambda-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the kpl-kds-kda pattern', () => {
    new KplKdsKda(app, 'kpl-kds-kda', { description: 'kpl-kds-kda-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the kds-kdf-s3 pattern', () => {
    new KdsKdfS3(app, 'kds-kdf-s3', { description: 'kds-kdf-s3-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the kds-kda-apigw pattern', () => {
    new KdsKdaApiGw(app, 'kds-kda-apigw', { description: 'kds-kda-apigw-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the msk-standalone-cluster pattern', () => {
    new MskStandalone(app, 'msk-standalone-cluster', { description: 'msk-standalone-cluster-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the msk-lambda pattern', () => {
    new MskLambda(app, 'msk-lambda', { description: 'msk-lambda-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the msk-lambda-kdf pattern', () => {
    new MskLambdaKdf(app, 'msk-lambda-kdf', { description: 'msk-lambda-kdf-test', solutionId: 'SO0999' });
    app.synth();
});

test('creates the msk-kda-s3 pattern', () => {
    new MskKdaS3(app, 'msk-kda-s3', { description: 'msk-kda-s3-test', solutionId: 'SO0999' });
    app.synth();
});
