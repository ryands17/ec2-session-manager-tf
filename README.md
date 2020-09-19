# cdktf EC2 Session Manager

This is an [cdktf](https://github.com/hashicorp/terraform-cdk/) project where you can create an EC2 instance in a VPC with Session Manager login so that SSH is not required.

## Steps

1. Rename the `.example.env` file to `.env` and replace all the values with predefined values for your stack (not mandatory).

2. Run `yarn` (recommended) or `npm install`

3. Run `yarn cdk deploy --profile profileName` to deploy the stack to your specified region. You can skip providing the profile name if it is `default`. You can learn about creating profiles using the aws-cli [here](https://docs.aws.amazon.com/cli/latest/reference/configure/#configure).

4. Now you can SSH into your newly created EC2 instance with Session Manager without SSH hassels and check that Node has been installed via _User Data_.

The `cdktf.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `yarn watch` watch for changes and compile
- `yarn test` perform the jest unit tests
- `yarn cdk deploy` deploy this stack to your default AWS account/region
- `yarn cdk synth` emits the synthesized CloudFormation template

Todo:

- [ ] Add tests
