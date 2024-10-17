/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk  from 'aws-cdk-lib';

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

        if (!resource.cfnOptions.metadata) {
            resource.cfnOptions.metadata = {};
        }

        resource.cfnOptions.metadata.cfn_nag = {
            rules_to_suppress: uniqueRules
        }
    }
}
