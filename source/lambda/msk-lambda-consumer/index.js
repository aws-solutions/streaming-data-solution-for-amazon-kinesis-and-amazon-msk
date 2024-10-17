/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

exports.handler = async (event) => {
    console.log(`Received event: ${JSON.stringify(event, null, 2)}`);
    let numberOfRecords = 0;

    for (let key in event.records) {
        event.records[key].map(record => {
           const msg = Buffer.from(record.value, 'base64').toString();
           console.log(`Message: ${msg}`);

           numberOfRecords++;
        });
    }

    return `Successfully processed ${numberOfRecords} records.`;
};
