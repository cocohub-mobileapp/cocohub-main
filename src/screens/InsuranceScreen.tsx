import React, { useState } from'react';
import { Button, Form, Input, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { postClaim } from '../services/claimsService';

const { Dragger } = Upload;

const InsuranceScreen: React.FC = () => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | undefined>();
  const [fileList, setFileList] = useState<any[]>([]);
  const [claimStatus, setClaimStatus] = useState<string>('');

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(parseFloat(e.target.value));
  };

  const handleFileChange = (info: any) => {
    setFileList(info.fileList);
  };

  const handleSubmit = async () => {
    if (!description || amount === undefined || fileList.length === 0) {
      message.error('Please fill in all fields and upload at least one file.');
      return;
    }

    try {
      const formData = new FormData();
      fileList.forEach((file) => {
        formData.append('attachments', file.originFileObj);
      });
      formData.append('description', description);
      formData.append('amount', amount.toString());

      const response = await postClaim(formData);
      setClaimStatus(response.status);
      message.success('Claim submitted successfully!');
    } catch (error) {
      message.error('Failed to submit claim. Please try again.');
    }
  };

  return (
    <div>
      <h1>Insurance Claims</h1>
      <Form onFinish={handleSubmit}>
        <Form.Item label="Description">
          <Input value={description} onChange={handleDescriptionChange} />
        </Form.Item>
        <Form.Item label="Amount">
          <Input type="number" value={amount} onChange={handleAmountChange} />
        </Form.Item>
        <Form.Item label="Attachments">
          <Dragger
            name="attachments"
            multiple
            onChange={handleFileChange}
            fileList={fileList}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
          </Dragger>
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Submit Claim
        </Button>
      </Form>
      {claimStatus && <div>Status: {claimStatus}</div>}
    </div>
  );
};

export default InsuranceScreen;