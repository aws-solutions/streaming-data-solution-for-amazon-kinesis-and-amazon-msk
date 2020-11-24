######################################################################################################################
#  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           #
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

import unittest
import boto3
import botocore.session
from botocore.stub import Stubber
from unittest.mock import patch

no_metrics = ['']
all_metrics = [
    'IncomingBytes',
    'IncomingRecords',
    'OutgoingBytes',
    'OutgoingRecords',
    'WriteProvisionedThroughputExceeded',
    'ReadProvisionedThroughputExceeded',
    'IteratorAgeMilliseconds'
]

class LambdaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._kinesis = botocore.session.get_session().create_client('kinesis')
        stubber = Stubber(cls._kinesis)

        stubber.add_response('enable_enhanced_monitoring', {
            'StreamName': 'test-stream',
            'DesiredShardLevelMetrics': all_metrics
        })

        stubber.add_response('disable_enhanced_monitoring', {
            'StreamName': 'test-stream',
            'DesiredShardLevelMetrics': no_metrics
        })

        stubber.activate()

    @patch.object(boto3, 'client')
    def test_01_enable_monitoring(self, mock_client):
        mock_client.return_value = self._kinesis

        from lambda_function import _enhance_monitoring
        response_metrics = _enhance_monitoring('test-stream', 'true')

        self.assertCountEqual(all_metrics, response_metrics)

    @patch.object(boto3, 'client')
    def test_02_disable_monitoring(self, mock_client):
        mock_client.return_value = self._kinesis

        from lambda_function import _enhance_monitoring
        response_metrics = _enhance_monitoring('test-stream', 'false')

        self.assertCountEqual(no_metrics, response_metrics)
