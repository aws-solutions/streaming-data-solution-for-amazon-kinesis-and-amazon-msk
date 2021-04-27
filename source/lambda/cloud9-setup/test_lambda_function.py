######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                #
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
from datetime import datetime

sample_role = {
    'Path': '/role-path/',
    'RoleName': 'test-role-name-123',
    'RoleId': 'test-role-id-1234',
    'Arn': 'test-role-arn-123456',
    'CreateDate': datetime(2015, 1, 1)
}

stub_role = {
    'Role': sample_role
}

stub_instance_profile = {
    'InstanceProfile': {
        'Path': '/ins-profile-path/',
        'InstanceProfileName': 'ins-profile-name',
        'InstanceProfileId': 'test-ins-profile-id',
        'Arn': 'test-ins-profile-arn',
        'CreateDate': datetime(2015, 1, 1),
        'Roles': [sample_role]
    }
}

class LambdaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['AWS_SDK_USER_AGENT'] = '{ "user_agent_extra": "AwsSolution/SO9999/v0.0.1" }'
        config = botocore.config.Config(**json.loads(os.environ['AWS_SDK_USER_AGENT']))

        cls._iam = botocore.session.get_session().create_client('iam', config=config)
        stubber = Stubber(cls._iam)

        stubber.add_response('get_role', stub_role)
        stubber.add_response('get_instance_profile', stub_instance_profile)

        stubber.add_client_error('get_role', service_error_code='NoSuchEntityException')
        stubber.add_response('create_role', stub_role)
        stubber.add_response('attach_role_policy', {})
        stubber.add_client_error('get_instance_profile', service_error_code='NoSuchEntityException')
        stubber.add_response('create_instance_profile', stub_instance_profile)
        stubber.add_response('add_role_to_instance_profile', {})

        stubber.add_response('get_role', stub_role)
        stubber.add_client_error('get_instance_profile', service_error_code='NoSuchEntityException')
        stubber.add_response('create_instance_profile', stub_instance_profile)
        stubber.add_response('add_role_to_instance_profile', {})

        stubber.activate()

    @classmethod
    def tearDownClass(cls):
        del os.environ['AWS_SDK_USER_AGENT']

    @patch.object(boto3, 'client')
    def test_01_does_not_create_resources_if_existing(self, mock_client):
        mock_client.return_value = self._iam

        from lambda_function import _create_iam_resources
        (created_role, created_instance_profile) = _create_iam_resources()

        self.assertFalse(created_role)
        self.assertFalse(created_instance_profile)

    @patch.object(boto3, 'client')
    def test_02_creates_both_resources_if_not_found(self, mock_client):
        mock_client.return_value = self._iam

        from lambda_function import _create_iam_resources
        (created_role, created_instance_profile) = _create_iam_resources()

        self.assertTrue(created_role)
        self.assertTrue(created_instance_profile)

    @patch.object(boto3, 'client')
    def test_03_creates_only_missing_resources(self, mock_client):
        mock_client.return_value = self._iam

        from lambda_function import _create_iam_resources
        (created_role, created_instance_profile) = _create_iam_resources()

        self.assertFalse(created_role)
        self.assertTrue(created_instance_profile)
