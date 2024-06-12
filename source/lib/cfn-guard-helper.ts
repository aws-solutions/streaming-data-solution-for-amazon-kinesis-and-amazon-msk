/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      *
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

import * as cdk  from 'aws-cdk-lib';

export class CfnGuardHelper {
    public static addSuppressions(resource: cdk.CfnResource, suppressions: string | string[]) {
        let rules = [];

        if (suppressions instanceof Array) {
            for (const suppression of suppressions) {
                rules.push(suppression);
            }
        } else {
            rules.push(suppressions);
        }

        // Ensure that the metadata property exists.
        if (!resource.cfnOptions.metadata) {
            resource.cfnOptions.metadata = {};
        }

        if (resource.cfnOptions.metadata.guard?.SuppressedRules) {
            // If the CfnResource already contains some suppressions, we don't want to erase them.
            const existingRules = resource.cfnOptions.metadata.guard.SuppressedRules;
            rules = [...existingRules, ...rules];
        }

        // It's possible that multiple constructs try to add the same suppression.
        // We only keep one occurrence (last) of each.
        const uniqueRules = [
            ...new Map(
                rules.map(rule => [rule, rule])
            ).values()
        ];

        resource.cfnOptions.metadata.guard = {
            SuppressedRules: uniqueRules
        }
    }
}
