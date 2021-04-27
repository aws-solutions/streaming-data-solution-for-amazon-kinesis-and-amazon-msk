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

export interface CfnNagSuppression {
    Id: string;
    Reason: string;
}

export class CfnNagHelper {
    public static addSuppressions(resource: cdk.CfnResource, suppressions: CfnNagSuppression | CfnNagSuppression[]) {
        let rules = [];

        if (suppressions instanceof Array) {
            for (const suppression of suppressions) {
                rules.push({ id: suppression.Id, reason: suppression.Reason });
            }
        } else {
            rules.push({ id: suppressions.Id, reason: suppressions.Reason });
        }

        if (resource.cfnOptions.metadata?.cfn_nag) {
            // If the CfnResource already contains some suppressions, we don't want to erase them.
            const existingRules = resource.cfnOptions.metadata.cfn_nag.rules_to_suppress;
            rules = [...existingRules, ...rules];
        }

        // It's possible that multiple constructs try to add the same suppression.
        // We only keep one occurrence (last) of each.
        // Based on https://stackoverflow.com/a/56768137
        const uniqueRules = [
            ...new Map(
                rules.map(rule => [rule.id, rule])
            ).values()
        ];

        resource.cfnOptions.metadata = {
            cfn_nag: {
                rules_to_suppress: uniqueRules
            }
        };
    }
}
