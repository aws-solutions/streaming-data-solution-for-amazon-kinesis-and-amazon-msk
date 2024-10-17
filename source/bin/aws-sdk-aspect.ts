/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */
import {Construct, IConstruct} from 'constructs';
import * as cdk  from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';

export class AwsSdkConfig extends Construct implements cdk.IAspect {
    private readonly solutionId: string;

    constructor(scope: Construct, id: string, solutionId: string) {
        super(scope, id);
        this.solutionId = solutionId;
    }

    public visit(node: IConstruct): void {
        let userAgent = '';

        if (node instanceof lambda.Function) {
            const runtimeFamily = node.runtime.family;

            if (runtimeFamily == lambda.RuntimeFamily.NODEJS) {
                userAgent = `{ "customUserAgent": "AwsSolution/${this.solutionId}/%%VERSION%%" }`;
            } else if (runtimeFamily == lambda.RuntimeFamily.PYTHON) {
                userAgent = `{ "user_agent_extra": "AwsSolution/${this.solutionId}/%%VERSION%%" }`
            }

            node.addEnvironment('AWS_SDK_USER_AGENT', userAgent);
        }
    }
}
