const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const axios = require('axios');
const { admin, bucket, db } = require('./firebaseAdmin');

exports.handler = async (event, context) => {
    try {
        const { uid, userName } = JSON.parse(event.body);

        if (!userName || !uid) {
            throw new Error('Nome do usuário ou UID não fornecido.');
        }

        const pdfUrl = 'https://example.com/path/to/certificado-base.pdf';
        const response = await axios.get(pdfUrl, {
            responseType: 'arraybuffer',
            timeout: 8000,
        });

        const existingPdfBytes = response.data;
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const signatureText = userName;
        const fontSize = 10;

        const textWidth = helveticaFont.widthOfTextAtSize(signatureText, fontSize);
        const pageWidth = firstPage.getWidth();
        const pageHeight = firstPage.getHeight();
        const x = (pageWidth - textWidth) / 2;
        const y = (pageHeight - fontSize) / 2;

        firstPage.drawText(signatureText, {
            x: x,
            y: y,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });

        const modifiedPdfBytes = await pdfDoc.save();
        const pdfFileName = `${userName.replace(/\s+/g, '_')}-certificado.pdf`;

        await bucket.file(`pdf/${pdfFileName}`).save(modifiedPdfBytes, {
            contentType: 'application/pdf',
            metadata: {
                metadata: {
                    firebaseStorageDownloadTokens: Date.now(),
                },
            },
        });

        const pdfDownloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/pdf%2F${encodeURIComponent(pdfFileName)}?alt=media&token=${Date.now()}`;

        const notificationRef = db.collection('users').doc(uid).collection('notifications').doc();
        await notificationRef.set({
            title: 'Certificado Gerado',
            description: 'Seu certificado foi gerado com sucesso. Clique para baixar.',
            photoUrl: 'https://firebasestorage.googleapis.com/v0/b/nail-art-by-gessica.appspot.com/o/icon%2Fcertificado.png?alt=media&token=f294abf5-93e8-4bb5-b3e2-ccdebac9ebf5',
            pdfUrl: pdfDownloadUrl,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'PDF modificado enviado para o Firebase Storage e notificação criada', fileName: pdfFileName }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
