import json
import boto3

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = 'vpn_app_users'
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    # TODO implement

    body = json.loads(event['body'])
    email = body.get('email')

    try:
        response = table.get_item(Key={'email': email})
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'message':'Error getting user'})
        }

    if 'Item' not in response:
        return {
            'statusCode': 404,
            'body': json.dumps({'message':'User not found'})
        }

    item = response['Item']
    device_id = item.get('device_id')

    user_id = item.get('user_id')

    if not device_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'message':'Device ID not found'})
        }
    return {
        'statusCode': 200,
        'body': json.dumps({'deviceId': device_id, 'userId': user_id})
    }