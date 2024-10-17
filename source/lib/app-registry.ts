#!/usr/bin/env node
/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

import * as appreg from "@aws-cdk/aws-servicecatalogappregistry-alpha";
import * as cdk  from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';

export interface AppRegistryProps {
    readonly solutionID: string;
}

export class AppRegistry extends Construct implements cdk.IAspect {
    private solutionName: string;
    private solutionID: string;
    private solutionVersion: string;
    private id: string;

    /**
     * An application type attribute initialized in the constructor of this class
     */
    private applicationType: string;

    /**
     * The instance of application that the solution stacks should be associated with
     */
    private application: appreg.Application;
    /**
     * An application name attribute initialized in the constructor, created during build time
     */
    private applicationName: string;

    constructor(scope: Construct, id: string, props: AppRegistryProps) {
        super(scope, id);
        this.id = id;

        this.solutionID = props.solutionID;
        this.solutionName = '%%SOLUTION_NAME%%';
        this.solutionVersion = '%%VERSION%%';
        this.applicationName = '%%APP_REG_NAME%%';
        this.applicationType = 'AWS-Solutions';
    }

    /**
     * Method invoked as a `Visitor` pattern to inject aspects during cdk synthesis
     *
     * @param node
     */
    public visit(node: IConstruct): void {
        if (node instanceof cdk.Stack) {
            if (!node.nested) {
                // parent stack
                const stack = node as cdk.Stack;
                this.createAppForAppRegistry(this.id);
                this.application.associateApplicationWithStack(stack);
                this.createAttributeGroup();
                this.addTagsforApplication();
            } else {
                // nested stack
                if (!this.application) {
                    this.createAppForAppRegistry(this.id);
                }
                this.application.associateApplicationWithStack(node);
            }
        }
    }

    /**
     * Method to initialize an Application in AppRegistry service
     *
     * @returns - Instance of AppRegistry's Application class
     */
    private createAppForAppRegistry(id: string): void {
        this.application = new appreg.Application(this, `AppRegistrySetup-${id}`, {
            applicationName: cdk.Fn.join('-', ['App', cdk.Aws.STACK_NAME, this.applicationName]),
            description: `Service Catalog application to track and manage all your resources for the solution ${this.solutionName}`
        });
    }

    /**
     * Method to add tags to the AppRegistry's Application instance
     *
     */
    private addTagsforApplication(): void {
        if (!this.application) {
            this.createAppForAppRegistry(this.id);
        }
        cdk.Tags.of(this.application).add('Solutions:SolutionID', this.solutionID);
        cdk.Tags.of(this.application).add('Solutions:SolutionName', this.solutionName);
        cdk.Tags.of(this.application).add('Solutions:SolutionVersion', this.solutionVersion);
        cdk.Tags.of(this.application).add('Solutions:ApplicationType', this.applicationType);
    }

    /**
     * Method to create AttributeGroup to be associated with the Application's instance in AppRegistry
     *
     */
    private createAttributeGroup(): void {
        if (!this.application) {
            this.createAppForAppRegistry(this.id);
        }
        this.application.associateAttributeGroup(
            new appreg.AttributeGroup(this, 'ApplicationAttributes', {
                attributeGroupName: `AttrGrp-${cdk.Aws.STACK_NAME}`,
                description: 'Attributes for Solutions Metadata',
                attributes: {
                    applicationType: this.applicationType,
                    version: this.solutionVersion,
                    solutionID: this.solutionID,
                    solutionName: this.solutionName
                }
            })
        );
    }
}
