/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
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
import * as lambda from '@aws-cdk/aws-lambda';

export class AwsSdkConfig extends cdk.Construct implements cdk.IAspect {
    private readonly solutionId: string;

    constructor(scope: cdk.Construct, id: string, solutionId: string) {
        super(scope, id);
        this.solutionId = solutionId;
    }

    public visit(node: cdk.IConstruct): void {
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
