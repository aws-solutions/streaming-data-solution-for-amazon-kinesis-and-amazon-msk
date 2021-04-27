######################################################################################################################
#  Copyright 2020-2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

import unittest, boto3, os, json
import botocore.config
import botocore.session
from botocore.stub import Stubber
from unittest.mock import patch

class LambdaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['AWS_SDK_USER_AGENT'] = '{ "user_agent_extra": "AwsSolution/SO9999/v0.0.1" }'
        config = botocore.config.Config(**json.loads(os.environ['AWS_SDK_USER_AGENT']))

        cls._kinesisAnalytics = botocore.session.get_session().create_client('kinesisanalyticsv2', config=config)
        stubber = Stubber(cls._kinesisAnalytics)

        stubber.add_response('describe_application', stub_application_without_vpc)

        stubber.add_response('describe_application', stub_application_without_vpc)
        stubber.add_response('add_application_vpc_configuration', stub_vpc_config1)

        stubber.add_response('describe_application', stub_application_with_vpc)
        stubber.add_response('delete_application_vpc_configuration', stub_delete_config)
        stubber.add_response('add_application_vpc_configuration', stub_vpc_config2)

        stubber.add_response('describe_application', stub_application_without_vpc)

        stubber.add_response('describe_application', stub_application_with_vpc)
        stubber.add_response('delete_application_vpc_configuration', stub_delete_config)

        stubber.activate()

    @classmethod
    def tearDownClass(cls):
        del os.environ['AWS_SDK_USER_AGENT']

    @patch.object(boto3, 'client')
    def test_01_add_config_noop(self, mock_client):
        mock_client.return_value = self._kinesisAnalytics

        from lambda_function import _add_vpc_configuration
        response = _add_vpc_configuration('test-application', [''], [''])
        self.assertIsNone(response)

    @patch.object(boto3, 'client')
    def test_02_add_config_without_existing(self, mock_client):
        mock_client.return_value = self._kinesisAnalytics

        from lambda_function import _add_vpc_configuration
        response = _add_vpc_configuration('test-application', ['subnet-abc'], ['sg-abc'])
        self.assertEqual('vpc-version-a', response)

    @patch.object(boto3, 'client')
    def test_03_add_config_with_existing(self, mock_client):
        mock_client.return_value = self._kinesisAnalytics

        from lambda_function import _add_vpc_configuration
        response = _add_vpc_configuration('test-application', ['subnet-abc'], ['sg-abc'])
        self.assertEqual('vpc-version-b', response)

    @patch.object(boto3, 'client')
    def test_04_remove_config_without_existing(self, mock_client):
        mock_client.return_value = self._kinesisAnalytics

        from lambda_function import _delete_vpc_configuration
        response = _delete_vpc_configuration('test-application')
        self.assertIsNone(response)

    @patch.object(boto3, 'client')
    def test_05_remove_config_with_existing(self, mock_client):
        mock_client.return_value = self._kinesisAnalytics

        from lambda_function import _delete_vpc_configuration
        response = _delete_vpc_configuration('test-application')
        self.assertEqual(60, response)

    def test_06_filter_items(self):
        from lambda_function import _filter_empty_items

        non_empty_expected = ['id-1', 'id-2']
        non_empty_actual = _filter_empty_items(['id-1', '', 'id-2'])
        self.assertCountEqual(non_empty_expected, non_empty_actual)

        empty_expected = []
        empty_actual = _filter_empty_items([''])
        self.assertCountEqual(empty_expected, empty_actual)

stub_application_without_vpc = {
    'ApplicationDetail': {
        'ApplicationConfigurationDescription': {},
        'ApplicationARN': 'some-arn',
        'ApplicationName': 'test-application',
        'RuntimeEnvironment': 'FLINK-1_11',
        'ApplicationStatus': 'READY',
        'ApplicationVersionId': 99
    }
}

stub_vpc_config1 = {
    'VpcConfigurationDescription': {
        'VpcConfigurationId': 'vpc-version-a',
        'VpcId': 'vpc-id',
        'SubnetIds': ['subnet-abc'],
        'SecurityGroupIds': ['sg-abc']
    }
}

stub_vpc_config2 = {
    'VpcConfigurationDescription': {
        'VpcConfigurationId': 'vpc-version-b',
        'VpcId': 'vpc-id',
        'SubnetIds': ['subnet-abc'],
        'SecurityGroupIds': ['sg-abc']
    }
}

stub_application_with_vpc = {
    'ApplicationDetail': {
        'ApplicationConfigurationDescription': {
            'VpcConfigurationDescriptions': [{
                'VpcConfigurationId': 'vpc-version-a',
                'VpcId': 'vpc-id',
                'SubnetIds': ['subnet-abc'],
                'SecurityGroupIds': ['sg-abc']
            }]
        },
        'ApplicationARN': 'some-arn',
        'ApplicationName': 'test-application',
        'RuntimeEnvironment': 'FLINK-1_11',
        'ApplicationStatus': 'READY',
        'ApplicationVersionId': 50
    }
}

stub_delete_config = {
    'ApplicationARN': 'some-arn',
    'ApplicationVersionId': 60
}
