/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as cdk from 'aws-cdk-lib';
import * as crypto from 'crypto';

import { Capture, Template } from 'aws-cdk-lib/assertions';

import { AppRegistry } from '../lib/app-registry';

describe('When a generic stack is registered with AppRegistry', () => {
    let template: Template;
    let app: cdk.App;
    let stack: cdk.Stack;
    const fakeSolutionId = 'SO999';

    beforeAll(() => {
        app = new cdk.App();
        stack = new cdk.Stack(app, 'TestStack');

        const hash = crypto.createHash('sha256').update(stack.stackName).digest('hex');
        cdk.Aspects.of(stack).add(
            new AppRegistry(stack, `AppRegistry-${hash}`, {
                solutionID: fakeSolutionId
            })
        );
        template = Template.fromStack(stack);
    });

    it('Should create a ServiceCatalog Application', () => {
        template.resourceCountIs('AWS::ServiceCatalogAppRegistry::Application', 1);
        template.hasResourceProperties('AWS::ServiceCatalogAppRegistry::Application', {
            'Name': {
                'Fn::Join': ['-', ['App', { Ref: 'AWS::StackName' }, '%%APP_REG_NAME%%']]
            },
            'Description':
                'Service Catalog application to track and manage all your resources for the solution %%SOLUTION_NAME%%',
            Tags: {
                'Solutions:ApplicationType': 'AWS-Solutions',
                'Solutions:SolutionID': fakeSolutionId,
                'Solutions:SolutionName': '%%SOLUTION_NAME%%',
                'Solutions:SolutionVersion': '%%VERSION%%'
            }
        });
    });

    it('Should have AttributeGroupAssociation', () => {
        const attGrpCapture = new Capture();
        template.resourceCountIs('AWS::ServiceCatalogAppRegistry::AttributeGroupAssociation', 1);
        template.hasResourceProperties('AWS::ServiceCatalogAppRegistry::AttributeGroupAssociation', {
            Application: {
                'Fn::GetAtt': [attGrpCapture, 'Id']
            },
            AttributeGroup: {
                'Fn::GetAtt': [attGrpCapture, 'Id']
            }
        });
        attGrpCapture.next();
        expect(template.toJSON()['Resources'][attGrpCapture.asString()]['Type']).toStrictEqual(
            'AWS::ServiceCatalogAppRegistry::AttributeGroup'
        );
    });

    it('should have AttributeGroup', () => {
        template.resourceCountIs('AWS::ServiceCatalogAppRegistry::AttributeGroup', 1);
        template.hasResourceProperties('AWS::ServiceCatalogAppRegistry::AttributeGroup', {
            Attributes: {
                applicationType: 'AWS-Solutions',
                version: '%%VERSION%%',
                solutionID: fakeSolutionId,
                solutionName: '%%SOLUTION_NAME%%'
            }
        });
    });

    it('Should not have a ResourceAssociation for a nested stack', () => {
        template.resourceCountIs('AWS::ServiceCatalogAppRegistry::ResourceAssociation', 1);
    });
});
