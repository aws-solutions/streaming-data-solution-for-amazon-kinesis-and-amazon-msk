/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

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
