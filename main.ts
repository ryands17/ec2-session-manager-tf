import { config } from 'dotenv'
config()
import { Construct } from 'constructs'
import { App, TerraformStack, Token } from 'cdktf'
import * as aws from './.gen/providers/aws'

const REGION = process.env.REGION || 'us-east-1'
const tagName = 'session-manager'
const userData = `
  #!/bin/bash
  set -eu -o pipefail
  touch /home/ubuntu/before.txt
  apt-get update && apt-get upgrade -y
  apt-get install build-essential -y
  touch /home/ubuntu/middle.txt
  curl -sL https://deb.nodesource.com/setup_12.x | bash -
  apt-get install nodejs -y
  touch /home/ubuntu/after.txt
`

class EC2Session extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name)

    const provider = new aws.AwsProvider(this, 'aws', {
      region: REGION,
    })
    const azs = new aws.DataAwsAvailabilityZones(this, 'region-azs', {
      provider,
      state: 'available',
    })

    // Create the VPC and corresponding Internet Gateway
    const vpc = new aws.Vpc(this, `${tagName}-vpc`, {
      tags: { Name: `${tagName}/vpc` },
      cidrBlock: '192.168.0.0/24',
      enableDnsSupport: true,
      enableDnsHostnames: true,
    })
    const ig = new aws.InternetGateway(this, `${tagName}-ig`, {
      vpcId: Token.asString(vpc.id),
      tags: { Name: `${tagName}/ig` },
    })

    // A public subnet to deploy an instance to
    const publicSb = new aws.Subnet(this, `${tagName}-public-subnet`, {
      vpcId: Token.asString(vpc.id),
      cidrBlock: '192.168.0.0/26',
      availabilityZone: `\${${azs.fqn}.names[0]}`,
      mapPublicIpOnLaunch: true,
      tags: { Name: `${tagName}/public-subnet` },
    })

    // A route table with a route to an Internet Gateway and subnet association
    const publicRt = new aws.RouteTable(this, `${tagName}-public-rt`, {
      vpcId: Token.asString(vpc.id),
      route: [
        {
          cidrBlock: '0.0.0.0/0',
          gatewayId: Token.asString(ig.id),
          egressOnlyGatewayId: '',
          instanceId: '',
          ipv6CidrBlock: '',
          natGatewayId: '',
          networkInterfaceId: '',
          transitGatewayId: '',
          vpcPeeringConnectionId: '',
        },
      ],
      tags: { Name: `${tagName}/public-rt` },
    })
    new aws.RouteTableAssociation(this, `${tagName}-public-rt-assn`, {
      routeTableId: Token.asString(publicRt.id),
      subnetId: Token.asString(publicSb.id),
    })

    // Role, Policy & Instance Profile to connect via SSM
    const instancePolicy = new aws.DataAwsIamPolicyDocument(
      this,
      `${tagName}-ec2-basic`,
      {
        statement: [
          {
            actions: ['sts:AssumeRole'],
            principals: [
              { type: 'Service', identifiers: ['ec2.amazonaws.com'] },
            ],
          },
        ],
      }
    )

    const role = new aws.IamRole(this, `${tagName}-ec2Role`, {
      name: `${tagName}-ec2Instance-role`,
      path: '/',
      assumeRolePolicy: Token.asString(instancePolicy.json),
    })

    new aws.IamRolePolicyAttachment(this, `${tagName}-attach-ssm`, {
      role: Token.asString(role.id),
      policyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
    })

    const instanceProfile = new aws.IamInstanceProfile(
      this,
      `${tagName}-ec2-instanceProfile`,
      {
        name: `${tagName}-ec2-instanceProfile`,
        path: '/',
        role: Token.asString(role.id),
      }
    )

    // deploying an EC2 instance in the public subnet
    const ami = new aws.DataAwsAmi(this, `${tagName}-ubuntu-ami`, {
      mostRecent: true,
      filter: [
        {
          name: 'name',
          values: ['ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*'],
        },
        { name: 'virtualization-type', values: ['hvm'] },
      ],
      // Canonical owner ID
      owners: ['099720109477'],
    })

    new aws.Instance(this, `${tagName}-instance`, {
      ami: Token.asString(ami.id),
      // ami: 'ami-07efac79022b86107',
      instanceType: 't2.micro',
      associatePublicIpAddress: true,
      iamInstanceProfile: Token.asString(instanceProfile.name),
      subnetId: Token.asString(publicSb.id),
      userData: userData.trim(),
      tags: {
        Name: `${tagName}/instance`,
      },
    })
  }
}

const app = new App()
new EC2Session(app, 'ec2-tf')
app.synth()
