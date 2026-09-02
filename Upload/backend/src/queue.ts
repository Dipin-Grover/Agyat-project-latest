import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const sqs = new SQSClient({ region: process.env.AWS_REGION! });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION! });

const queueUrl = process.env.AWS_SQS_QUEUE_URL!;
const tableName = process.env.AWS_DYNAMO_DB_NAME!;

export async function lPush(id: string) {
    try {
        await sqs.send(new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: id
        }));

        await dynamo.send(new PutItemCommand({
            TableName: tableName,
            Item: {
                id: { S: id },
                status: { S: "uploaded" }
            }
        }));

        console.log(`Successfully pushed ${id} to queue and set status to uploaded`);
    } catch (error) {
        console.error(`Error processing ${id}:`, error);
        throw error;
    }
}