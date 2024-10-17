/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */


import * as cdk  from 'aws-cdk-lib';

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
