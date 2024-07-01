const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const admin = require('./firebaseAdmin'); // Importa o módulo Firebase Admin

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

exports.handler = async (event, context) => {
    // Caminho para o arquivo certificado.pdf dentro do diretório da função
    const pdfPath = path.resolve(__dirname, 'certificado.pdf');
    
    try {
        // Carrega o arquivo PDF
        const existingPdfBytes = await fs.readFile(pdfPath);
        
        // Carrega o documento PDF
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        
        // Modifica o campo de formulário "FULLNAME"
        const formFieldName = 'FULLNAME';
        const formFieldValue = 'ERISSON MIQUEIAS COSTA CALHEIROS';
        
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const fullNameField = fields.find(field => field.getName() === formFieldName);
        
        if (fullNameField) {
            fullNameField.setText(formFieldValue);
        } else {
            throw new Error(`Campo de formulário "${formFieldName}" não encontrado.`);
        }
        
        // Salva o PDF modificado como uma cópia
        const modifiedPdfBytes = await pdfDoc.save();
        
        // Envia o arquivo modificado para o Firebase Storage
        const bucket = storage.bucket('SEU_BUCKET_ID'); // Substitua pelo ID do seu bucket
        const fileName = 'certificado_modificado.pdf';
        const filePath = `pdf/${fileName}`;
        
        const file = bucket.file(filePath);
        await file.save(modifiedPdfBytes, {
            contentType: 'application/pdf',
            metadata: {
                metadata: {
                    firebaseStorageDownloadTokens: Date.now(),
                },
            },
        });
        
        // URL do arquivo no Firebase Storage
        const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        
        return {
            statusCode: 200,
            body: JSON.stringify({ downloadUrl }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
