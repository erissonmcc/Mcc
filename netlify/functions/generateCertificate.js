const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const axios = require('axios');
const { admin, bucket } = require('./firebaseAdmin');

exports.handler = async (event, context) => {
    try {
        const data = JSON.parse(event.body);
        const { userName, uid } = data;

        if (!userName) {
            throw new Error('Nome do usuário não fornecido.');
        }

        console.log('Iniciando geração do certificado para:', userName);

        // URL do arquivo PDF base
        const pdfUrl = 'https://drive.usercontent.google.com/u/0/uc?id=19Aht8l8dCpLyl9as9f52t97nZFuAJwEM&export=download';

        // Baixa o conteúdo do arquivo PDF
        const response = await axios.get(pdfUrl, {
            responseType: 'arraybuffer',
            timeout: 8000, // Limite de tempo de 8 segundos para o download
        });

        console.log('Arquivo PDF base baixado com sucesso');

        // Lê o conteúdo do PDF a partir do arraybuffer
        const existingPdfBytes = response.data;

        // Carrega o documento PDF base
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Pega a primeira página do PDF base (ou ajuste conforme necessário)
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Define a fonte Helvetica
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Define o texto da assinatura
        const signatureText = userName;
        const fontSize = 10; // Ajuste o tamanho da fonte

        // Calcula a largura do texto para centralização
        const textWidth = helveticaFont.widthOfTextAtSize(signatureText, fontSize);
        const pageWidth = firstPage.getWidth();
        const pageHeight = firstPage.getHeight();

        // Coordenadas X e Y para centralizar o texto
        const x = (pageWidth - textWidth) / 2;
        const y = (pageHeight - fontSize) / 2; // Centralizado verticalmente

        // Adiciona o texto da assinatura na página
        firstPage.drawText(signatureText, {
            x: x,
            y: y,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0), // Cor preta
        });

        // Salva o PDF modificado como uma cópia
        const modifiedPdfBytes = await pdfDoc.save();

        // Nome do arquivo PDF no Firebase Storage
        const pdfFileName = `${userName.replace(/\s+/g, '_')}-certificado.pdf`;

        // Upload do PDF modificado para o Firebase Storage
        await bucket.file(`pdf/${pdfFileName}`).save(modifiedPdfBytes, {
            contentType: 'application/pdf',
            metadata: {
                metadata: {
                    firebaseStorageDownloadTokens: Date.now(),
                },
            },
        });

        console.log('PDF modificado enviado para o Firebase Storage:', pdfFileName);

        // Obter a URL do PDF modificado
        const [url] = await bucket.file(`pdf/${pdfFileName}`).getSignedUrl({
            action: 'read',
            expires: '03-09-2024', // Ajuste conforme necessário
        });

        console.log('URL do PDF modificado:', url);

        // Enviar notificação para o UID do usuário
        await admin.firestore().collection('users').doc(uid).collection('notifications').add({
            title: 'Seu certificado está pronto!',
            description: 'Clique aqui para baixar seu certificado.',
            photoUrl: url,
            pdfUrl: url, // Adicionando a URL do PDF no parâmetro pdfUrl
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('Notificação enviada com sucesso para:', uid);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'PDF modificado enviado para o Firebase Storage e notificação enviada.', fileName: pdfFileName }),
        };
    } catch (error) {
        console.error('Erro ao gerar certificado:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
