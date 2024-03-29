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
    BOOTSTRAP_SERVER_PLAINTEXT = 'bootstrap-url1-plaintext:9092,bootstrap-url2-plaintext:9092'
    BOOTSTRAP_SERVER_TLS = 'bootstrap-url1-tls:9094,bootstrap-url2-tls:9094'
    BOOTSTRAP_SERVER_SCRAM = 'bootstrap-url1-iam:9096,bootstrap-url2-iam:9096'
    BOOTSTRAP_SERVER_IAM = 'bootstrap-url1-iam:9098,bootstrap-url2-iam:9098'

    CLIENT_SUBNETS = ['subnet-a', 'subnet-b']
    SECURITY_GROUPS = ['sg-abc123']

    @classmethod
    def setUpClass(cls):
        os.environ['AWS_SDK_USER_AGENT'] = '{ "user_agent_extra": "AwsSolution/SO9999/v0.0.1" }'
        config = botocore.config.Config(**json.loads(os.environ['AWS_SDK_USER_AGENT']))

        cls._kafka = botocore.session.get_session().create_client('kafka', config=config)
        stubber = Stubber(cls._kafka)

        stubber.add_response('describe_cluster', {
            'ClusterInfo': {
                'BrokerNodeGroupInfo': {
                    'ClientSubnets': cls.CLIENT_SUBNETS,
                    'SecurityGroups': cls.SECURITY_GROUPS,
                    'InstanceType': 'kafka.t3.small'
                }
            }
        })

        # Cluster with "Only plaintext traffic allowed" and "Unauthenticated access"
        stubber.add_response('get_bootstrap_brokers', {
            'BootstrapBrokerString': cls.BOOTSTRAP_SERVER_PLAINTEXT
        })

        # Cluster with "Only TLS encrypted traffic allowed" and "Unauthenticated access"
        stubber.add_response('get_bootstrap_brokers', {
            'BootstrapBrokerStringTls': cls.BOOTSTRAP_SERVER_TLS
        })

        # Cluster with "Both TLS encrypted and plaintext traffic allowed" and "Unauthenticated access"
        stubber.add_response('get_bootstrap_brokers', {
            'BootstrapBrokerString': cls.BOOTSTRAP_SERVER_PLAINTEXT,
            'BootstrapBrokerStringTls': cls.BOOTSTRAP_SERVER_TLS
        })

        # Cluster with "IAM access control"
        stubber.add_response('get_bootstrap_brokers', {
            'BootstrapBrokerStringSaslIam': cls.BOOTSTRAP_SERVER_IAM
        })

        # Cluster with "IAM access control" and "Unauthenticated access"
        stubber.add_response('get_bootstrap_brokers', {
            'BootstrapBrokerString': cls.BOOTSTRAP_SERVER_PLAINTEXT,
            'BootstrapBrokerStringTls': cls.BOOTSTRAP_SERVER_TLS,
            'BootstrapBrokerStringSaslIam': cls.BOOTSTRAP_SERVER_IAM
        })

        # Cluster with "IAM access control" and "SASL/SCRAM authentication"
        stubber.add_response('get_bootstrap_brokers', {
            'BootstrapBrokerString': cls.BOOTSTRAP_SERVER_PLAINTEXT,
            'BootstrapBrokerStringSaslScram': cls.BOOTSTRAP_SERVER_SCRAM,
            'BootstrapBrokerStringSaslIam': cls.BOOTSTRAP_SERVER_IAM
        })

        stubber.activate()

    @classmethod
    def tearDownClass(cls):
        del os.environ['AWS_SDK_USER_AGENT']

    @patch.object(boto3, 'client')
    def test_01_get_networking_details(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_networking_config
        (subnets, security_groups) = _get_networking_config('my-cluster-arn')

        self.assertCountEqual(self.CLIENT_SUBNETS, subnets)
        self.assertCountEqual(self.SECURITY_GROUPS, security_groups)

    @patch.object(boto3, 'client')
    def test_02_get_bootstrap_servers_plaintext_only(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_bootstrap_brokers
        bootstrap_servers = _get_bootstrap_brokers('my-cluster-arn')

        self.assertEqual(self.BOOTSTRAP_SERVER_PLAINTEXT, bootstrap_servers)

    @patch.object(boto3, 'client')
    def test_03_get_bootstrap_servers_tls_only(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_bootstrap_brokers
        bootstrap_servers = _get_bootstrap_brokers('my-cluster-arn')

        self.assertEqual(self.BOOTSTRAP_SERVER_TLS, bootstrap_servers)

    @patch.object(boto3, 'client')
    def test_04_get_bootstrap_servers_tls_and_plaintext(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_bootstrap_brokers
        bootstrap_servers = _get_bootstrap_brokers('my-cluster-arn')

        self.assertEqual(self.BOOTSTRAP_SERVER_TLS, bootstrap_servers)
        self.assertNotEqual(self.BOOTSTRAP_SERVER_PLAINTEXT, bootstrap_servers)

    @patch.object(boto3, 'client')
    def test_05_get_bootstrap_servers_iam(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_bootstrap_brokers
        bootstrap_servers = _get_bootstrap_brokers('my-cluster-arn')

        self.assertEqual(self.BOOTSTRAP_SERVER_IAM, bootstrap_servers)

    @patch.object(boto3, 'client')
    def test_06_get_bootstrap_servers_iam_and_unauthenticated(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_bootstrap_brokers
        bootstrap_servers = _get_bootstrap_brokers('my-cluster-arn')

        self.assertEqual(self.BOOTSTRAP_SERVER_IAM, bootstrap_servers)
        self.assertNotEqual(self.BOOTSTRAP_SERVER_TLS, bootstrap_servers)
        self.assertNotEqual(self.BOOTSTRAP_SERVER_PLAINTEXT, bootstrap_servers)

    @patch.object(boto3, 'client')
    def test_07_get_bootstrap_servers_iam_and_scram(self, mock_client):
        mock_client.return_value = self._kafka

        from lambda_function import _get_bootstrap_brokers
        bootstrap_servers = _get_bootstrap_brokers('my-cluster-arn')

        self.assertEqual(self.BOOTSTRAP_SERVER_SCRAM, bootstrap_servers)
        self.assertNotEqual(self.BOOTSTRAP_SERVER_IAM, bootstrap_servers)
        self.assertNotEqual(self.BOOTSTRAP_SERVER_PLAINTEXT, bootstrap_servers)
